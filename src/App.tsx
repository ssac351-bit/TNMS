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
import { isFirestoreQuotaExhausted, markFirestoreQuotaExhausted, isQuotaError } from './lib/quotaManager';
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
      console.log("Fetching organizations...");
      try {
        let orgs: Organization[] = [];

        if (!isFirestoreQuotaExhausted()) {
          try {
            const fetchPromise = getDocs(collection(db, 'Organizations'));
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Firestore fetch timeout")), 3000)
            );

            const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
            orgs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Organization));
            console.log("Fetched organizations from Firestore:", orgs);
          } catch (fbErr: any) {
            if (isQuotaError(fbErr)) {
              markFirestoreQuotaExhausted(fbErr);
            }
            console.warn("Firestore fetchOrganizations failed/timeout:", fbErr?.message || fbErr);
          }
        }
        
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
        console.warn("Error fetching organizations (using local fallback): ", error);
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
        const canWriteFirestore = !isFirestoreQuotaExhausted();
        for (const org of deleted) {
          if (canWriteFirestore) {
            try {
              await deleteDoc(doc(db, 'Organizations', org.id));
            } catch (fbErr: any) {
              if (isQuotaError(fbErr)) markFirestoreQuotaExhausted(fbErr);
            }
          }
          await deleteFromSupabase('Organizations', org.id);
        }
        for (const org of savedOrUpd) {
          if (canWriteFirestore) {
            try {
              await setDoc(doc(db, 'Organizations', org.id), org);
            } catch (fbErr: any) {
              if (isQuotaError(fbErr)) markFirestoreQuotaExhausted(fbErr);
            }
          }
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

  // Session validity is handled cleanly on login and explicit user logout actions
  // Removed automatic effect that was resetting the user back to the login screen

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
