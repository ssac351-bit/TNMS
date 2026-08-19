/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Organization, Staff } from './types';
import LoginScreen from './components/LoginScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import OrgAdminDashboard from './components/OrgAdminDashboard';
import BranchManagerDashboard from './components/BranchManagerDashboard';
import StaffDashboard from './components/StaffDashboard';
import MemberDashboard from './components/MemberDashboard';
import { db } from './lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { saveToSupabase, deleteFromSupabase } from './lib/supabase';
import { hydrateOrgFromCloud, hydrateAllOrgsFromCloud } from './lib/cloudAutoSync';
import { PwaFloatingButton } from './components/PwaFloatingButton';

export default function App() {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('tanzil_session_loggedIn') === 'true';
  });
  const [userRole, setUserRole] = useState<'super_admin' | 'org_admin' | 'bm' | 'staff' | 'member' | null>(() => {
    return (localStorage.getItem('tanzil_session_role') as any) || null;
  });
  const [activeOrg, setActiveOrg] = useState<Organization | null>(() => {
    const saved = localStorage.getItem('tanzil_session_activeOrg');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeStaff, setActiveStaff] = useState<Staff | null>(() => {
    const saved = localStorage.getItem('tanzil_session_activeStaff');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeMember, setActiveMember] = useState<any | null>(() => {
    const saved = localStorage.getItem('tanzil_session_activeMember');
    return saved ? JSON.parse(saved) : null;
  });

  // Organizations registry
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const localSaved = localStorage.getItem('tanzil_orgs');
      return localSaved ? JSON.parse(localSaved) : [];
    } catch {
      return [];
    }
  });
  const [loadingOrgs, setLoadingOrgs] = useState(() => {
    try {
      const localSaved = localStorage.getItem('tanzil_orgs');
      return !localSaved || JSON.parse(localSaved).length === 0;
    } catch {
      return true;
    }
  });

  // Ref to track previous organization list for syncing with Firestore
  const prevOrgsRef = useRef<Organization[]>(organizations);

  // Fetch organizations from Firestore and merge with localStorage to prevent data loss
  useEffect(() => {
    async function fetchOrganizations() {
      console.log("Fetching organizations from Firestore...");
      try {
        const fetchPromise = getDocs(collection(db, 'Organizations'));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firestore fetch timeout")), 3000)
        );

        const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
        const orgs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Organization));
        console.log("Fetched organizations:", orgs);
        
        // Merge with existing local storage organizations so the user keeps current NGOs
        const localSaved = localStorage.getItem('tanzil_orgs');
        const localOrgs: Organization[] = localSaved ? JSON.parse(localSaved) : [];
        
        const mergedMap = new Map<string, Organization>();
        localOrgs.forEach(o => mergedMap.set(o.id, o));
        orgs.forEach(o => mergedMap.set(o.id, o));
        
        const finalOrgs = Array.from(mergedMap.values());

        setOrganizations(finalOrgs);
        prevOrgsRef.current = finalOrgs;
        localStorage.setItem('tanzil_orgs', JSON.stringify(finalOrgs));

        // Dynamically refresh the logged-in session of activeOrg with freshest Firestore/Local merged data
        const sessionActiveOrg = localStorage.getItem('tanzil_session_activeOrg');
        if (sessionActiveOrg) {
          const parsedSessionOrg = JSON.parse(sessionActiveOrg);
          const freshOrg = finalOrgs.find(o => o.id === parsedSessionOrg.id);
          if (freshOrg) {
            setActiveOrg(freshOrg);
            localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(freshOrg));
            // Immediate priority auto-hydration for active logged-in org
            const sessionStaff = localStorage.getItem('tanzil_session_activeStaff');
            const staffObj = sessionStaff ? JSON.parse(sessionStaff) : null;
            hydrateOrgFromCloud(freshOrg.id, staffObj?.staffId || staffObj?.id);
          }
        }

        // Automatic background cloud auto-hydration for all organizations on app start
        hydrateAllOrgsFromCloud(finalOrgs);
      } catch (error) {
        console.warn("Error/Timeout fetching organizations from Firestore (using local fallback): ", error);
        // Fallback to local storage
        const localSaved = localStorage.getItem('tanzil_orgs');
        const parsed: Organization[] = localSaved ? JSON.parse(localSaved) : [];

        setOrganizations(parsed);
        prevOrgsRef.current = parsed;
        localStorage.setItem('tanzil_orgs', JSON.stringify(parsed));

        const sessionActiveOrg = localStorage.getItem('tanzil_session_activeOrg');
        if (sessionActiveOrg) {
          const parsedSessionOrg = JSON.parse(sessionActiveOrg);
          const freshOrg = parsed.find((o: any) => o.id === parsedSessionOrg.id);
          if (freshOrg) {
            setActiveOrg(freshOrg);
            localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(freshOrg));
            const sessionStaff = localStorage.getItem('tanzil_session_activeStaff');
            const staffObj = sessionStaff ? JSON.parse(sessionStaff) : null;
            hydrateOrgFromCloud(freshOrg.id, staffObj?.staffId || staffObj?.id);
          }
        }
        hydrateAllOrgsFromCloud(parsed);
      } finally {
        setLoadingOrgs(false);
        console.log("Loading organizations finished.");
      }
    }
    fetchOrganizations();
  }, []);

  // Sync organizations with Firestore and localStorage on any changes
  useEffect(() => {
    if (organizations.length === 0 && prevOrgsRef.current.length === 0) return;

    localStorage.setItem('tanzil_orgs', JSON.stringify(organizations));

    const prev = prevOrgsRef.current;
    
    // Deleted organizations: present in prev, but not in current
    const deleted = prev.filter(p => !organizations.some(c => c.id === p.id));
    // Added or updated organizations: present in current, and (either not in prev or modified)
    const savedOrUpd = organizations.filter(c => {
      const pMatch = prev.find(p => p.id === c.id);
      if (!pMatch) return true; // new
      return JSON.stringify(pMatch) !== JSON.stringify(c); // updated
    });

    async function syncChanges() {
      try {
        for (const org of deleted) {
          await deleteDoc(doc(db, 'Organizations', org.id));
          await deleteFromSupabase('Organizations', org.id);
        }
        for (const org of savedOrUpd) {
          await setDoc(doc(db, 'Organizations', org.id), org);
          await saveToSupabase('Organizations', org.id, org);
        }
      } catch (err) {
        console.warn("Error syncing organizations to Firestore/Supabase:", err);
      }
    }

    if (deleted.length > 0 || savedOrUpd.length > 0) {
      syncChanges();
    }
    
    prevOrgsRef.current = organizations;
  }, [organizations]);

  // Validate active session against latest organizations / staff data to enforce security changes
  useEffect(() => {
    if (!isLoggedIn) return;
    if (loadingOrgs) return;

    const savedPass = localStorage.getItem('tanzil_session_password');

    // 1. Check Super Admin session
    if (userRole === 'super_admin') {
      const isValidSuperAdminLocal = savedPass === 'tanzil@super_admin#2026';
      const isValidSuperAdminOnline = activeOrg === null && activeStaff === null; 

      if (!isValidSuperAdminLocal && !isValidSuperAdminOnline) {
        handleLogout();
        alert('সুপার এডমিন সেশন অকার্যকর হয়েছে! দয়া করে আবার লগইন করুন।');
      }
      return;
    }

    // 2. Check Org Admin session
    if (userRole === 'org_admin' && activeOrg) {
      const currentOrg = organizations.find(o => o.id === activeOrg.id);
      if (!currentOrg) {
        handleLogout();
        alert('আপনার প্রতিষ্ঠানটি সিস্টেমে পাওয়া যায়নি! সেশন বন্ধ করা হয়েছে।');
      } else if (currentOrg.adminPassword !== savedPass) {
        handleLogout();
        alert('আপনার প্রতিষ্ঠানের এডমিন পাসওয়ার্ড পরিবর্তন করা হয়েছে! দয়া করে নতুন পাসওয়ার্ড দিয়ে আবার লগইন করুন।');
      }
      return;
    }

    // 3. Check Branch Manager / Staff session
    if ((userRole === 'bm' || userRole === 'staff') && activeOrg && activeStaff) {
      const savedStaffListStr = localStorage.getItem(`tanzil_staff_${activeOrg.id}`);
      if (savedStaffListStr) {
        try {
          const staffList: Staff[] = JSON.parse(savedStaffListStr);
          const currentStaff = staffList.find(s => s.id === activeStaff.id || (s.staffId && s.staffId.toLowerCase() === activeStaff.staffId.toLowerCase()));
          
          if (!currentStaff) {
            handleLogout();
            alert('আপনার কর্মী অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি! সেশন বন্ধ করা হয়েছে।');
          } else if (currentStaff.password !== savedPass) {
            handleLogout();
            alert('আপনার পাসওয়ার্ড পরিবর্তন করা হয়েছে! দয়া করে নতুন পাসওয়ার্ড দিয়ে আবার লগইন করুন।');
          }
        } catch (e) {
          console.error("Error parsing staff list for session validation:", e);
        }
      }
    }
  }, [isLoggedIn, userRole, activeOrg, activeStaff, organizations, loadingOrgs]);

  // Periodically check session validity to handle multi-device changes instantly
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const interval = setInterval(() => {
      const currentRole = localStorage.getItem('tanzil_session_role');
      const currentSavedPass = localStorage.getItem('tanzil_session_password');
      const currentActiveOrgStr = localStorage.getItem('tanzil_session_activeOrg');
      const currentActiveStaffStr = localStorage.getItem('tanzil_session_activeStaff');

      if (currentRole === 'super_admin') {
        if (currentSavedPass !== 'tanzil@super_admin#2026' && !currentActiveOrgStr) {
          handleLogout();
          alert('সুপার এডমিন সেশন অকার্যকর হয়েছে! দয়া করে আবার লগইন করুন।');
        }
        return;
      }

      if (currentRole === 'org_admin' && currentActiveOrgStr) {
        const activeO = JSON.parse(currentActiveOrgStr);
        const latestOrgsSaved = localStorage.getItem('tanzil_orgs');
        if (latestOrgsSaved) {
          const orgsList: Organization[] = JSON.parse(latestOrgsSaved);
          if (orgsList.length > 0) {
            const currentO = orgsList.find(o => o.id === activeO.id);
            if (!currentO) {
              handleLogout();
              alert('আপনার প্রতিষ্ঠানটি সিস্টেমে পাওয়া যায়নি! সেশন বন্ধ করা হয়েছে।');
            } else if (currentO.adminPassword !== currentSavedPass) {
              handleLogout();
              alert('আপনার প্রতিষ্ঠানের এডমিন পাসওয়ার্ড পরিবর্তন করা হয়েছে! দয়া করে নতুন পাসওয়ার্ড দিয়ে আবার লগইন করুন।');
            }
          }
        }
      }

      if ((currentRole === 'bm' || currentRole === 'staff') && currentActiveOrgStr && currentActiveStaffStr) {
        const activeO = JSON.parse(currentActiveOrgStr);
        const activeS = JSON.parse(currentActiveStaffStr);
        const savedStaffListStr = localStorage.getItem(`tanzil_staff_${activeO.id}`);
        if (savedStaffListStr) {
          try {
            const staffList: Staff[] = JSON.parse(savedStaffListStr);
            const currentS = staffList.find(s => s.id === activeS.id || (s.staffId && s.staffId.toLowerCase() === activeS.staffId.toLowerCase()));
            
            if (!currentS) {
              handleLogout();
              alert('আপনার কর্মী অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি! সেশন বন্ধ করা হয়েছে।');
            } else if (currentS.password !== currentSavedPass) {
              handleLogout();
              alert('আপনার পাসওয়ার্ড পরিবর্তন করা হয়েছে! দয়া করে নতুন পাসওয়ার্ড দিয়ে আবার লগইন করুন।');
            }
          } catch (e) {
            console.error("Error parsing staff list in validation interval:", e);
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Handle successful login
  const handleLoginSuccess = (role: 'super_admin' | 'org_admin' | 'bm' | 'staff' | 'member', activeOrganization?: Organization, matchedUser?: any, typedPassword?: string) => {
    setUserRole(role);
    localStorage.setItem('tanzil_session_role', role);
    if (typedPassword) {
      localStorage.setItem('tanzil_session_password', typedPassword);
    } else {
      localStorage.removeItem('tanzil_session_password');
    }
    if (role === 'org_admin' && activeOrganization) {
      setActiveOrg(activeOrganization);
      localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(activeOrganization));
      setActiveStaff(null);
      localStorage.removeItem('tanzil_session_activeStaff');
      setActiveMember(null);
      localStorage.removeItem('tanzil_session_activeMember');
    } else if ((role === 'bm' || role === 'staff') && activeOrganization && matchedUser) {
      setActiveOrg(activeOrganization);
      localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(activeOrganization));
      setActiveStaff(matchedUser);
      localStorage.setItem('tanzil_session_activeStaff', JSON.stringify(matchedUser));
      setActiveMember(null);
      localStorage.removeItem('tanzil_session_activeMember');
    } else if (role === 'member' && activeOrganization && matchedUser) {
      setActiveOrg(activeOrganization);
      localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(activeOrganization));
      setActiveMember(matchedUser);
      localStorage.setItem('tanzil_session_activeMember', JSON.stringify(matchedUser));
      setActiveStaff(null);
      localStorage.removeItem('tanzil_session_activeStaff');
    } else {
      setActiveOrg(null);
      localStorage.removeItem('tanzil_session_activeOrg');
      setActiveStaff(null);
      localStorage.removeItem('tanzil_session_activeStaff');
      setActiveMember(null);
      localStorage.removeItem('tanzil_session_activeMember');
    }
    setIsLoggedIn(true);
    localStorage.setItem('tanzil_session_loggedIn', 'true');

    // Trigger instant cloud auto-load on login
    if (activeOrganization?.id) {
      hydrateOrgFromCloud(activeOrganization.id, matchedUser?.staffId || matchedUser?.id);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setActiveOrg(null);
    setActiveStaff(null);
    setActiveMember(null);
    localStorage.removeItem('tanzil_session_loggedIn');
    localStorage.removeItem('tanzil_session_role');
    localStorage.removeItem('tanzil_session_activeOrg');
    localStorage.removeItem('tanzil_session_activeStaff');
    localStorage.removeItem('tanzil_session_activeMember');
    localStorage.removeItem('tanzil_session_password');
  };

  const handleUpdateOrg = (updatedOrg: Organization) => {
    setActiveOrg(updatedOrg);
    localStorage.setItem('tanzil_session_activeOrg', JSON.stringify(updatedOrg));
    if (activeOrg && activeOrg.id === updatedOrg.id) {
      localStorage.setItem('tanzil_session_password', updatedOrg.adminPassword);
    }
    setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));
  };

  return (
    <>
      {isLoggedIn ? (
        userRole === 'super_admin' ? (
          <SuperAdminDashboard 
            organizations={organizations}
            setOrganizations={setOrganizations}
            onLogout={handleLogout}
          />
        ) : userRole === 'org_admin' && activeOrg ? (
          <OrgAdminDashboard 
            org={activeOrg}
            onLogout={handleLogout}
            onUpdateOrg={handleUpdateOrg}
          />
        ) : (userRole === 'bm' || userRole === 'staff') && activeOrg && activeStaff ? (
          <BranchManagerDashboard
            org={activeOrg}
            staff={activeStaff}
            onLogout={handleLogout}
          />
        ) : userRole === 'member' && activeOrg && activeMember ? (
          <MemberDashboard
            org={activeOrg}
            member={activeMember}
            onLogout={handleLogout}
          />
        ) : (
          <LoginScreen 
            organizations={organizations}
            onLoginSuccess={handleLoginSuccess}
          />
        )
      ) : (
        <LoginScreen 
          organizations={organizations}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      <PwaFloatingButton />
    </>
  );
}
