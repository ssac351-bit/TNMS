import React, { useState, useEffect } from 'react';
import { Group, Member, Organization, Staff, Holiday, LoanProductConfig } from '../types';
import { 
  Calendar, User, FileText, ArrowLeft, Save, Info, AlertTriangle, 
  Settings, Plus, Trash2, ListOrdered, ChevronDown, ChevronUp, CheckCircle2,
  Edit
} from 'lucide-react';

function getDayNumFromBengali(dayName?: string): number {
  if (!dayName) return 6; // Default to Saturday
  const dLower = dayName.toLowerCase();
  if (dLower.includes('রবি') || dLower.includes('sun')) return 0;
  if (dLower.includes('সোম') || dLower.includes('mon')) return 1;
  if (dLower.includes('মঙ্গ') || dLower.includes('tue')) return 2;
  if (dLower.includes('বুধ') || dLower.includes('wed')) return 3;
  if (dLower.includes('বৃহ') || dLower.includes('thu')) return 4;
  if (dLower.includes('শুক্র') || dLower.includes('fri')) return 5;
  if (dLower.includes('শনি') || dLower.includes('sat')) return 6;
  return 6; // fallback to Saturday
}

const DEFAULT_LOAN_PRODUCTS: LoanProductConfig[] = [
  { id: 'lp-jagoron', name: 'জাগরণ (ক্ষুদ্র ব্যবসা ঋণ)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক' },
  { id: 'lp-agroshor', name: 'অগ্রসর (উদ্যোক্তা ঋণ)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক' },
  { id: 'lp-sufolon', name: 'সুফলন (কৃষি চাষাবাদ ঋণ)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক' },
  { id: 'lp-buniad', name: 'বুনিয়াদ (অতিদরিদ্র ও দুস্থ সহায়তা)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.12, type: 'সাপ্তাহিক' },
  { id: 'lp-livestock', name: 'গাভী পালন ও মৎস্য ডেইরি', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক' },
  { id: 'lp-monthly-special', name: 'মাসিক কিস্তি ঋণ স্কিম', durationMonths: 12, installmentsCount: 12, serviceChargeRate: 0.24, type: 'মাসিক' },
  { id: 'lp-term-6m', name: 'মেয়াদি ঋণ স্কিম (৬ মাস)', durationMonths: 6, installmentsCount: 6, serviceChargeRate: 0.24, type: 'মেয়াদি', collectServiceChargeMonthly: true }
];

// Helper to parse workingDay to Date object safely
function parseWorkingDay(dayStr: string): Date {
  if (!dayStr) return new Date();
  const parts = dayStr.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  const timestamp = Date.parse(dayStr);
  return isNaN(timestamp) ? new Date() : new Date(timestamp);
}

// Helper to format Date to DD/MM/YYYY
function formatDateToDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Helper to format Date to YYYY-MM-DD for standard html inputs
function formatDateToYYYYMMDD(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function getBengaliDayOfWeek(d: Date): string {
  const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  return dayNames[d.getDay()];
}

function checkIsHoliday(d: Date, holidayList: Holiday[]): boolean {
  if (!Array.isArray(holidayList)) return false;
  const dateStr = d.toISOString().split('T')[0];
  const bDay = getBengaliDayOfWeek(d);
  
  return holidayList.some(h => {
    if (h.type === 'direct') {
      return h.date === dateStr;
    } else if (h.type === 'general') {
      return h.dayOfWeek === bDay;
    }
    return false;
  });
}

function checkWasOriginallyHoliday(baseDate: Date, i: number, loanType: 'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি', holidays: Holiday[], meetingDay?: string): boolean {
  let d = new Date(baseDate);
  if (loanType === 'সাপ্তাহিক') {
    const samityDayBengali = meetingDay || 'রবিবার';
    const samityDayNum = getDayNumFromBengali(samityDayBengali);
    
    // Find Zero Week Date (first meeting day on or after baseDate)
    let zeroWeekDate = new Date(baseDate);
    const currentDayNum = zeroWeekDate.getDay();
    const daysToAdd = (samityDayNum - currentDayNum + 7) % 7;
    zeroWeekDate.setDate(zeroWeekDate.getDate() + daysToAdd);
    
    const orgId = holidays[0]?.orgId || '';
    const gracePeriodStr = orgId ? (localStorage.getItem(`tanzil_loan_grace_${orgId}`) || '২ সপ্তাহ') : '২ সপ্তাহ';
    
    let graceWeeks = 1;
    if (gracePeriodStr.includes('দিন')) {
      graceWeeks = 0;
    } else if (gracePeriodStr.includes('১') || gracePeriodStr.includes('1')) {
      graceWeeks = 1;
    } else if (gracePeriodStr.includes('২') || gracePeriodStr.includes('2')) {
      graceWeeks = 2;
    } else if (gracePeriodStr.includes('৩') || gracePeriodStr.includes('3')) {
      graceWeeks = 3;
    } else if (gracePeriodStr.includes('৪') || gracePeriodStr.includes('4')) {
      graceWeeks = 4;
    } else {
      graceWeeks = 2;
    }
    
    let firstInstBase = new Date(zeroWeekDate);
    firstInstBase.setDate(firstInstBase.getDate() + Math.max(1, graceWeeks) * 7);
    
    d = new Date(firstInstBase);
    d.setDate(d.getDate() + ((i - 1) * 7));
  } else {
    d.setMonth(d.getMonth() + i);
    // Align to Samity Meeting Day
    const samityDayBengali = meetingDay || 'রবিবার';
    const samityDayNum = getDayNumFromBengali(samityDayBengali);
    const currentDayNum = d.getDay();
    const diff = samityDayNum - currentDayNum;
    d.setDate(d.getDate() + diff);
  }
  return checkIsHoliday(d, holidays);
}

function getAdjustedDate(baseDate: Date, i: number, loanType: 'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি', holidays: Holiday[], meetingDay?: string, previousDate?: Date): Date {
  if (loanType === 'সাপ্তাহিক') {
    const samityDayBengali = meetingDay || 'রবিবার';
    const samityDayNum = getDayNumFromBengali(samityDayBengali);
    
    // Find Zero Week Date (first meeting day on or after baseDate)
    let zeroWeekDate = new Date(baseDate);
    const currentDayNum = zeroWeekDate.getDay();
    const daysToAdd = (samityDayNum - currentDayNum + 7) % 7;
    zeroWeekDate.setDate(zeroWeekDate.getDate() + daysToAdd);
    
    const orgId = holidays[0]?.orgId || '';
    const gracePeriodStr = orgId ? (localStorage.getItem(`tanzil_loan_grace_${orgId}`) || '২ সপ্তাহ') : '২ সপ্তাহ';
    
    let graceWeeks = 1;
    if (gracePeriodStr.includes('দিন')) {
      graceWeeks = 0;
    } else if (gracePeriodStr.includes('১') || gracePeriodStr.includes('1')) {
      graceWeeks = 1;
    } else if (gracePeriodStr.includes('২') || gracePeriodStr.includes('2')) {
      graceWeeks = 2;
    } else if (gracePeriodStr.includes('৩') || gracePeriodStr.includes('3')) {
      graceWeeks = 3;
    } else if (gracePeriodStr.includes('৪') || gracePeriodStr.includes('4')) {
      graceWeeks = 4;
    } else {
      graceWeeks = 2;
    }
    
    let firstInstBase = new Date(zeroWeekDate);
    firstInstBase.setDate(firstInstBase.getDate() + Math.max(1, graceWeeks) * 7);
    
    let d = new Date(firstInstBase);
    d.setDate(d.getDate() + ((i - 1) * 7));
    while (checkIsHoliday(d, holidays)) {
      d.setDate(d.getDate() + 7);
    }
    return d;
  } else {
    const samityDayBengali = meetingDay || 'রবিবার';
    const samityDayNum = getDayNumFromBengali(samityDayBengali);

    // 1. Calculate the first installment date (i = 1) using standard setMonth + setDate (or just find the meeting day in month of baseDate + 1)
    let firstInstDate = new Date(baseDate);
    firstInstDate.setMonth(firstInstDate.getMonth() + 1);
    const currentDayNum = firstInstDate.getDay();
    const diff = samityDayNum - currentDayNum;
    firstInstDate.setDate(firstInstDate.getDate() + diff);

    // Find all meeting days in the month of firstInstDate
    const firstMonth = firstInstDate.getMonth();
    const firstYear = firstInstDate.getFullYear();
    const firstMonthMeetingDays: Date[] = [];
    for (let day = 1; day <= 31; day++) {
      const testDate = new Date(firstYear, firstMonth, day);
      if (testDate.getMonth() === firstMonth && testDate.getDay() === samityDayNum) {
        firstMonthMeetingDays.push(testDate);
      }
    }

    // Find which index matches the first installment date
    let chosenIndex = firstMonthMeetingDays.findIndex(d => d.getDate() === firstInstDate.getDate());
    if (chosenIndex === -1) {
      // Find the closest meeting day to the firstInstDate in the list
      let minDiff = Infinity;
      firstMonthMeetingDays.forEach((d, idx) => {
        const diffMs = Math.abs(d.getTime() - firstInstDate.getTime());
        if (diffMs < minDiff) {
          minDiff = diffMs;
          chosenIndex = idx;
        }
      });
    }
    if (chosenIndex === -1) {
      chosenIndex = 0;
    }

    // 2. Now for the target installment `i`:
    // The target month is exactly `baseDate.getMonth() + i`
    let targetMonth = baseDate.getMonth() + i;
    let targetYear = baseDate.getFullYear();
    while (targetMonth > 11) { targetMonth -= 12; targetYear++; }
    
    // Find all days in targetMonth/Year with meeting day
    const meetingDaysInMonth: Date[] = [];
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const testDate = new Date(targetYear, targetMonth, day);
        if (testDate.getDay() === samityDayNum) {
            meetingDaysInMonth.push(testDate);
        }
    }

    // Determine the ordinal index of the baseDate meeting day
    const baseMonth = baseDate.getMonth();
    const baseYear = baseDate.getFullYear();
    const baseMeetingDays: Date[] = [];
    const baseDaysInMonth = new Date(baseYear, baseMonth + 1, 0).getDate();
    for (let day = 1; day <= baseDaysInMonth; day++) {
        const testDate = new Date(baseYear, baseMonth, day);
        if (testDate.getDay() === samityDayNum) {
            baseMeetingDays.push(testDate);
        }
    }
    
    let baseIndex = baseMeetingDays.findIndex(d => d.getDate() >= baseDate.getDate());
    if (baseIndex === -1) baseIndex = baseMeetingDays.length - 1;
    
    // Pick the meeting day at the same ordinal index in the target month
    let d = meetingDaysInMonth[Math.min(baseIndex, meetingDaysInMonth.length - 1)] || meetingDaysInMonth[meetingDaysInMonth.length - 1] || new Date(targetYear, targetMonth, 15);
    
    // Holiday resolution: move to another valid meeting day in the same month if possible (backwards first, then forwards), or adjacent weeks
    if (checkIsHoliday(d, holidays)) {
        let validMeetingDays = meetingDaysInMonth.filter(date => !checkIsHoliday(date, holidays));
        
        if (validMeetingDays.length > 0) {
            // Find valid meeting day in the same month.
            // Priority 1: Closest valid day (prioritize backward if holiday, or just closest)
            let closestDate = validMeetingDays[0];
            let minDiff = Math.abs(closestDate.getTime() - d.getTime());
            
            for (const vDate of validMeetingDays) {
                const diff = Math.abs(vDate.getTime() - d.getTime());
                if (diff < minDiff) {
                    minDiff = diff;
                    closestDate = vDate;
                }
            }
            d = closestDate;
        } else {
            // If no valid meeting day in this month, look in adjacent weeks (maintaining same weekday)
            // Priority: Search backward first (previous week), then forward
            let found = false;
            let tempDate = new Date(d);
            
            // Search backward
            for (let j = 1; j <= 4; j++) {
                tempDate.setDate(tempDate.getDate() - 7);
                if (!checkIsHoliday(tempDate, holidays)) {
                    d = tempDate;
                    found = true;
                    break;
                }
            }
            // If not found backward, search forward
            if (!found) {
                tempDate = new Date(d);
                for (let j = 1; j <= 4; j++) {
                    tempDate.setDate(tempDate.getDate() + 7);
                    if (!checkIsHoliday(tempDate, holidays)) {
                        d = tempDate;
                        found = true;
                        break;
                    }
                }
            }
        }
    }
    return d;
  }
}

function getAdjustedDate_UNUSED(baseDate: Date, i: number, loanType: 'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি', holidays: Holiday[], meetingDay?: string, previousDate?: Date): Date {
   if (loanType === 'সাপ্তাহিক') {
     const samityDayBengali = meetingDay || 'রবিবার';
     const samityDayNum = getDayNumFromBengali(samityDayBengali);
     
     let firstInstBase = new Date(baseDate);
     const orgId = holidays[0]?.orgId || '';
     const gracePeriodStr = orgId ? (localStorage.getItem(`tanzil_loan_grace_${orgId}`) || '২ সপ্তাহ') : '২ সপ্তাহ';
     const graceDays = gracePeriodStr.includes('১') ? 7 : gracePeriodStr.includes('২') ? 14 : gracePeriodStr.includes('৩') ? 21 : gracePeriodStr.includes('৪') ? 28 : 14;
     firstInstBase.setDate(firstInstBase.getDate() + graceDays);
     
     const currentDayNum = firstInstBase.getDay();
     const daysToAdd = (samityDayNum - currentDayNum + 7) % 7;
     firstInstBase.setDate(firstInstBase.getDate() + daysToAdd);
     
     let d = new Date(firstInstBase);
     d.setDate(d.getDate() + ((i - 1) * 7));
     while (checkIsHoliday(d, holidays)) {
       d.setDate(d.getDate() + 7);
     }
     return d;
   } else if (loanType === 'মাসিক') {
     let d = new Date(baseDate);
     d.setMonth(d.getMonth() + i);
     while (checkIsHoliday(d, holidays)) {
       d.setDate(d.getDate() + 1);
     }
     return d;
   } else {
     let d = new Date(baseDate);
     d.setMonth(d.getMonth() + i);
     while (checkIsHoliday(d, holidays)) {
       d.setDate(d.getDate() + 1);
     }
     return d;
   }
}

function generateScheduleData(
  principal: number,
  countVal: number,
  interestRate: number,
  expectedDisburseDate: string,
  loanType: 'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি',
  interestMethod: 'reducing' | 'flat',
  collectServiceChargeMonthly: boolean,
  holidays: Holiday[],
  meetingDay?: string
) {
  if (principal <= 0 || countVal <= 0) {
    return {
      schedList: [],
      simulatedInterest: 0,
      totalPayable: 0,
      calculatedInstallment: 0
    };
  }

  const schedList: any[] = [];
  let remainingPrincipal = principal;
  const disburseBase = new Date(expectedDisburseDate);

  let calculatedInstallment = 0;
  let simulatedInterest = 0;
  let totalPayable = 0;

  // 1. Determine base weekly/monthly installment amount
  if (loanType === 'সাপ্তাহিক') {
    calculatedInstallment = Math.round((principal / 1000) * 25);
  } else if (loanType === 'মাসিক') {
    calculatedInstallment = Math.round((principal / 1000) * 95);
  } else if (loanType === 'মেয়াদি' && collectServiceChargeMonthly) {
    calculatedInstallment = Math.round((principal * interestRate) / 12);
  } else {
    calculatedInstallment = Math.round(principal / countVal);
  }

  if (interestMethod === 'reducing') {
    if (loanType === 'মেয়াদি' || countVal === 1) {
      if (loanType === 'মেয়াদি' && collectServiceChargeMonthly) {
        simulatedInterest = Math.round(principal * interestRate * (countVal / 12));
        totalPayable = principal + simulatedInterest;
        calculatedInstallment = Math.round(simulatedInterest / countVal);
      } else {
        const dueDate = getAdjustedDate(disburseBase, countVal, loanType, holidays, meetingDay);
        const daysDiff = Math.max(1, Math.round((dueDate.getTime() - disburseBase.getTime()) / (1000 * 60 * 60 * 24)));
        simulatedInterest = Math.round(principal * interestRate * (daysDiff / 365));
        totalPayable = principal + simulatedInterest;
        calculatedInstallment = totalPayable;
      }
    } else {
      let tempRemaining = principal;
      let cumInterest = 0;
      let prevDueDate = new Date(disburseBase);

      for (let i = 1; i <= countVal; i++) {
        const dueDate = getAdjustedDate(disburseBase, i, loanType, holidays, meetingDay, prevDueDate);

        // Day-based interest calculation
        const interestDays = Math.max(1, Math.round((dueDate.getTime() - prevDueDate.getTime()) / (1000 * 60 * 60 * 24)));
        let stepInterest = tempRemaining * interestRate * (interestDays / 365);
        stepInterest = Math.round(stepInterest * 100) / 100;

        let currentPrincipalValue = calculatedInstallment - stepInterest;
        if (i === countVal) {
          currentPrincipalValue = tempRemaining;
        } else {
          currentPrincipalValue = Math.min(tempRemaining, Math.max(0, currentPrincipalValue));
        }
        tempRemaining -= currentPrincipalValue;
        cumInterest += stepInterest;
        prevDueDate = dueDate;
      }

      simulatedInterest = Math.round(cumInterest);
      totalPayable = principal + simulatedInterest;
    }
  } else {
    // Flat method
    if (loanType === 'মেয়াদি' && collectServiceChargeMonthly) {
      simulatedInterest = Math.round(principal * interestRate * (countVal / 12));
    } else {
      simulatedInterest = Math.round(principal * interestRate);
    }
    totalPayable = principal + simulatedInterest;
    if (loanType !== 'সাপ্তাহিক' && loanType !== 'মাসিক') {
      calculatedInstallment = Math.round(totalPayable / countVal);
    }
  }

  remainingPrincipal = principal;
  let previousDueDate = new Date(disburseBase);

  if (loanType === 'মেয়াদি' && collectServiceChargeMonthly) {
    const loanDurationMonths = countVal;
    const monthlyInterest = Math.round((principal * interestRate) / 12);
    let sumInterest = 0;
    for (let i = 1; i <= loanDurationMonths; i++) {
      const dueDate = getAdjustedDate(disburseBase, i, 'মাসিক', holidays, meetingDay);
      const isLast = (i === loanDurationMonths);
      const stepInterest = isLast ? (Math.round(principal * interestRate * (loanDurationMonths / 12)) - sumInterest) : monthlyInterest;
      sumInterest += stepInterest;
      const stepPrincipal = isLast ? principal : 0;
      const stepTotal = stepPrincipal + stepInterest;

      schedList.push({
        installmentNo: i,
        dueDate: formatDateToDDMMYYYY(dueDate),
        dateObj: new Date(dueDate),
        principal: stepPrincipal,
        interest: stepInterest,
        total: stepTotal,
        remaining: isLast ? 0 : principal,
        isHoliday: checkIsHoliday(dueDate, holidays) || checkWasOriginallyHoliday(disburseBase, i, 'মাসিক', holidays, meetingDay)
      });
    }
  } else if (interestMethod === 'reducing') {
    if (loanType === 'মেয়াদি' || countVal === 1) {
      const dueDate = getAdjustedDate(disburseBase, countVal, loanType, holidays, meetingDay);
      const daysDiff = Math.max(1, Math.round((dueDate.getTime() - disburseBase.getTime()) / (1000 * 60 * 60 * 24)));
      const stepInterest = Math.round(principal * interestRate * (daysDiff / 365));
      const stepTotal = principal + stepInterest;
      
      schedList.push({
        installmentNo: 1,
        dueDate: formatDateToDDMMYYYY(dueDate),
        dateObj: new Date(dueDate),
        principal: principal,
        interest: stepInterest,
        total: stepTotal,
        remaining: 0,
        isHoliday: checkIsHoliday(dueDate, holidays) || checkWasOriginallyHoliday(disburseBase, countVal, loanType, holidays, meetingDay)
      });
    } else {
      let previousDueDateForSched = new Date(disburseBase);
      for (let i = 1; i <= countVal; i++) {
        const dueDate = getAdjustedDate(disburseBase, i, loanType, holidays, meetingDay, previousDueDateForSched);

        const isHolidayShifted = checkWasOriginallyHoliday(disburseBase, i, loanType, holidays, meetingDay);
        
        // Day-based interest calculation
        const interestDays = Math.max(1, Math.round((dueDate.getTime() - previousDueDateForSched.getTime()) / (1000 * 60 * 60 * 24)));
        let stepInterest = remainingPrincipal * interestRate * (interestDays / 365);
        stepInterest = Math.round(stepInterest * 100) / 100;

        let currentInstallmentAmount = calculatedInstallment;
        let currentInterestValue = stepInterest;
        let currentPrincipalValue = currentInstallmentAmount - currentInterestValue;

        if (i === countVal) {
          currentPrincipalValue = remainingPrincipal;
          currentInstallmentAmount = currentPrincipalValue + currentInterestValue;
        } else {
          currentPrincipalValue = Math.min(remainingPrincipal, Math.max(0, currentInstallmentAmount - currentInterestValue));
          currentInstallmentAmount = currentPrincipalValue + currentInterestValue;
        }

        remainingPrincipal -= currentPrincipalValue;
        previousDueDateForSched = dueDate;

        schedList.push({
          installmentNo: i,
          dueDate: formatDateToDDMMYYYY(dueDate),
          dateObj: new Date(dueDate),
          principal: Math.round(currentPrincipalValue * 100) / 100,
          interest: Math.round(currentInterestValue * 100) / 100,
          total: Math.round(currentInstallmentAmount * 100) / 100,
          remaining: Math.round(Math.max(0, remainingPrincipal) * 100) / 100,
          isHoliday: isHolidayShifted
        });
      }
    }
  } else {
    const baseInterest = Math.round(simulatedInterest / countVal);
    let remainingTotalPayable = totalPayable;
    remainingPrincipal = principal;

    for (let i = 1; i <= countVal; i++) {
      const dueDate = getAdjustedDate(disburseBase, i, loanType, holidays, meetingDay, previousDueDate);
      previousDueDate = dueDate;

      const isHolidayShifted = checkWasOriginallyHoliday(disburseBase, i, loanType, holidays, meetingDay);
      
      let currentInterestValue = Math.round(baseInterest);
      let currentInstallmentAmount = calculatedInstallment;
      let currentPrincipalValue = currentInstallmentAmount - currentInterestValue;

      if (i === countVal) {
        currentInstallmentAmount = remainingTotalPayable;
        currentPrincipalValue = remainingPrincipal;
        currentInterestValue = currentInstallmentAmount - currentPrincipalValue;
      } else {
        currentPrincipalValue = Math.min(remainingPrincipal, Math.max(0, currentInstallmentAmount - currentInterestValue));
        currentInstallmentAmount = currentPrincipalValue + currentInterestValue;
      }

      remainingPrincipal -= currentPrincipalValue;
      remainingTotalPayable -= currentInstallmentAmount;

      schedList.push({
        installmentNo: i,
        dueDate: formatDateToDDMMYYYY(dueDate),
        dateObj: new Date(dueDate),
        principal: currentPrincipalValue,
        interest: currentInterestValue,
        total: currentInstallmentAmount,
        remaining: Math.max(0, remainingPrincipal),
        isHoliday: isHolidayShifted
      });
    }
  }

  return {
    schedList,
    simulatedInterest,
    totalPayable,
    calculatedInstallment
  };
}

interface LoanProposalViewProps {
  onBack: () => void;
  branchGroups: Group[];
  groupMembers: Member[];
  workingDay: string;
  org: Organization;
  staff: Staff;
  defaultGroupId?: string;
  onSuccess: () => void;
  holidays: Holiday[];
  isReadOnly?: boolean;
}

export function LoanProposalView({
  onBack,
  branchGroups,
  groupMembers,
  workingDay,
  org,
  staff,
  defaultGroupId = '',
  onSuccess,
  holidays,
  isReadOnly = false
}: LoanProposalViewProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('ক্ষুদ্র ব্যবসা');
  const [proposedAmount, setProposedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Dynamic Configuration State (loaded from localStorage with pre-filled fallbacks) ---
  const [productConfigs, setProductConfigs] = useState<LoanProductConfig[]>(() => {
    const key = `tanzil_loan_product_configs_${org.id}`;
    const saved = localStorage.getItem(key);
    let configs: LoanProductConfig[] = [];
    if (saved) {
      try {
        configs = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    
    // Default to clean unified products if empty or containing duplicate clones
    if (!configs || configs.length === 0 || configs.some(c => c.name.includes('- ১২ মাস'))) {
      configs = [
        { id: 'lp-prathomik', name: 'প্রাথমিক ঋণ (General Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-jagoron', name: 'জাগরণ ঋণ (Microenterprise Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-agrosor', name: 'অগ্রসর ঋণ (Enterprise Loan)', durationMonths: 12, installmentsCount: 12, serviceChargeRate: 0.24, type: 'মাসিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-buniad', name: 'বুনিয়াদ ঋণ (Ultra Poor Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.20, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-krishi', name: 'কৃষি ও খামার ঋণ (Agriculture Loan)', durationMonths: 6, installmentsCount: 6, serviceChargeRate: 0.18, type: 'মেয়াদি', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24], collectServiceChargeMonthly: true }
      ];
      localStorage.setItem(key, JSON.stringify(configs));
    }

    return configs;
  });

  const [selectedProductId, setSelectedProductId] = useState<string>(productConfigs[0]?.id || 'lp-jagoron');
  const selectedProduct = productConfigs.find((p) => p.id === selectedProductId) || productConfigs[0];

  // Specific variables auto-derived from selected config
  const [interestRate, setInterestRate] = useState(0.24);
  const [installmentsCount, setInstallmentsCount] = useState('45');
  const [loanDurationMonths, setLoanDurationMonths] = useState(12);
  const [loanType, setLoanType] = useState<'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি'>('সাপ্তাহিক');
  const [collectServiceChargeMonthly, setCollectServiceChargeMonthly] = useState<boolean>(false);
  const [installmentAmount, setInstallmentAmount] = useState('0');
  const [interestMethod, setInterestMethod] = useState<'reducing' | 'flat'>('reducing');

  // Override config controls
  const [isCustomConfig, setIsCustomConfig] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // New configuration creation inputs
  const [newProdName, setNewProdName] = useState('');
  const [newProdDuration, setNewProdDuration] = useState('12');
  const [newProdInstallments, setNewProdInstallments] = useState('45');
  const [newProdRate, setNewProdRate] = useState('24');
  const [newProdType, setNewProdType] = useState<'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি'>('সাপ্তাহিক');

  // --- Product Editing State ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // --- Expected Disbursement Date ---
  const [expectedDisburseDate, setExpectedDisburseDate] = useState<string>(() => {
    const defaultDate = parseWorkingDay(workingDay);
    // Add 3 days as recommended default expected disbursement
    defaultDate.setDate(defaultDate.getDate() + 3);
    return formatDateToYYYYMMDD(defaultDate);
  });

  // Synchronize expected disburse date when working day changes
  useEffect(() => {
    if (workingDay) {
      const defaultDate = parseWorkingDay(workingDay);
      defaultDate.setDate(defaultDate.getDate() + 3);
      setExpectedDisburseDate(formatDateToYYYYMMDD(defaultDate));
    }
  }, [workingDay]);

  // --- Interactive Repayment Schedule Table ---
  const [calculatedSchedule, setCalculatedSchedule] = useState<any[] | null>(null);
  const [showScheduleResult, setShowScheduleResult] = useState(false);

  // Synchronize dynamic parameters when pre-set configurations are chosen (unless in custom mode)
  useEffect(() => {
    if (selectedProduct && !isCustomConfig) {
      setInterestRate(selectedProduct.serviceChargeRate);
      const isTerm = selectedProduct.type === 'মেয়াদি';
      setLoanType(selectedProduct.type);
      const collectMonthly = isTerm ? (selectedProduct.collectServiceChargeMonthly !== false) : (selectedProduct.collectServiceChargeMonthly || false);
      setCollectServiceChargeMonthly(collectMonthly);
      if (isTerm && collectMonthly) {
        setInstallmentsCount(String(selectedProduct.durationMonths || 6));
      } else {
        setInstallmentsCount(String(selectedProduct.installmentsCount));
      }
      setLoanDurationMonths(selectedProduct.durationMonths);
    }
  }, [selectedProductId, selectedProduct, isCustomConfig]);

  // Persist product configurations securely on catalog change
  useEffect(() => {
    localStorage.setItem(`tanzil_loan_product_configs_${org.id}`, JSON.stringify(productConfigs));
  }, [productConfigs, org.id]);

  // Sync selected group from default prop
  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroupId(defaultGroupId);
    }
  }, [defaultGroupId]);

  // Group and member bindings
  const selectedGroup = branchGroups.find((g) => g.id === selectedGroupId);
  const activeMembersInGroup = groupMembers.filter(
    (m) => m.groupId === selectedGroupId && (m.status === 'active' || !m.status)
  );
  const selectedMember = activeMembersInGroup.find((m) => m.id === selectedMemberId);

  // Real-time recalculation of installment and interest based on selected methods
  const principal = Number(proposedAmount) || 0;
  const count = Number(installmentsCount) || 45;

  // Synchronous, reactive derivation of schedule, interest and installments
  const scheduleData = React.useMemo(() => {
    const p = Number(proposedAmount) || 0;
    const countVal = Number(installmentsCount) || 45;
    const meetingDay = selectedGroup?.meetingDay || 'রবিবার';
    return generateScheduleData(
      p,
      countVal,
      interestRate,
      expectedDisburseDate,
      loanType,
      interestMethod,
      collectServiceChargeMonthly,
      holidays,
      meetingDay
    );
  }, [proposedAmount, installmentsCount, interestRate, expectedDisburseDate, loanType, interestMethod, collectServiceChargeMonthly, holidays, selectedGroup?.meetingDay]);

  const calculatedInstallment = scheduleData.calculatedInstallment;
  const simulatedInterest = scheduleData.simulatedInterest;
  const totalPayable = scheduleData.totalPayable;

  useEffect(() => {
    setInstallmentAmount(String(calculatedInstallment));
    setCalculatedSchedule(null);
    setShowScheduleResult(false);
  }, [proposedAmount, installmentsCount, interestRate, calculatedInstallment, interestMethod, loanType, collectServiceChargeMonthly]);
  const handleLoadSchedule = () => {
    if (principal <= 0) {
      setErrorMsg('দয়া করে প্রথমে প্রস্তাবিত ঋণের পরিমাণ ইনপুট করুন!');
      return;
    }
    setErrorMsg(null);

    const countVal = Number(installmentsCount) || 45;
    if (countVal <= 0) {
      setErrorMsg('কিস্তির সংখ্যা অবশ্যই শূন্য থেকে বেশি হতে হবে!');
      return;
    }

    setCalculatedSchedule(scheduleData.schedList);
    setShowScheduleResult(true);
  };

  // --- Save Proposal ---
  const handleSaveProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে ঋণ প্রস্তাব সাবমিট করতে পারবেন না। এটি রিড-অনলি মোডে রয়েছে।');
      return;
    }
    setErrorMsg(null);

    if (!selectedGroupId) {
      setErrorMsg('দয়া করে একটি সমিতি/গ্রুপ নির্বাচন করুন!');
      return;
    }
    if (!selectedMemberId || !selectedMember) {
      setErrorMsg('দয়া করে ঋণ গ্রহণের জন্য একজন সচল সদস্য নির্বাচন করুন!');
      return;
    }
    if (principal <= 0) {
      setErrorMsg('ঋণের পরিমাণ অবশ্যই ৫,০০০ টাকার বেশি হতে হবে!');
      return;
    }
    if (principal > 200000) {
      setErrorMsg('ঋণের সর্বোচ্চ সীমা ২,০০,০০০ টাকা!');
      return;
    }
    if (!expectedDisburseDate) {
      setErrorMsg('দয়া করে সম্ভাব্য ঋণ বিতরণের তারিখ সিলেক্ট করুন!');
      return;
    }

    // Get existing proposals to check if any pending proposal exists for this member
    const propKey = `tanzil_loan_proposals_${org.id}`;
    const savedProps = localStorage.getItem(propKey);
    const existingProps = savedProps ? JSON.parse(savedProps) : [];

    const hasPending = existingProps.some(
      (p: any) => p.memberId === selectedMember.id && p.status === 'pending'
    );

    if (hasPending) {
      setErrorMsg('এই সদস্যের একটি পূর্বেই অনুমোদনের জন্য অপেক্ষারত লোন প্রস্তাবনা বিদ্যমান রয়েছে!');
      return;
    }

    const nextProposalId = `prop-${Date.now()}`;
    const newProposal = {
      id: nextProposalId,
      orgId: org.id,
      branchId: staff.branchId || 'default-branch',
      groupId: selectedGroupId,
      groupName: branchGroups.find((g) => g.id === selectedGroupId)?.name || '',
      memberId: selectedMemberId,
      memberName: selectedMember.name,
      memberCode: selectedMember.memberId || '',
      memberIdText: selectedMember.memberId || '',
      proposedAmount: principal,
      amount: principal,
      durationMonths: loanDurationMonths,
      installmentsCount: loanType === 'মেয়াদি' && collectServiceChargeMonthly ? loanDurationMonths : Number(installmentsCount),
      installmentAmount: calculatedInstallment,
      totalPayable: totalPayable,
      serviceChargeRate: interestRate,
      interestMethod,
      loanType,
      collectServiceChargeMonthly: loanType === 'মেয়াদি' ? collectServiceChargeMonthly : false,
      expectedDisburseDate,
      purpose: loanPurpose,
      proposalDate: workingDay,
      createdBy: staff.name,
      remarks,
      status: 'pending',
      date: parseWorkingDay(workingDay).toISOString().split('T')[0]
    };

    localStorage.setItem(propKey, JSON.stringify([newProposal, ...existingProps]));

    if (onSuccess) {
      onSuccess();
    }
  };

  // All product configuration settings are managed in the Org Admin Dashboard (Configuration Sidebar).
  // On this proposal page, the user can select a pre-configured product category or override manually.

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">সদস্য ঋণ প্রস্তাব ফর্ম (Loan Proposal)</h3>
            <p className="text-[10px] text-slate-400 font-medium font-sans">শাখা ব্যবস্থাপক বা মাঠ সংগঠক কর্তৃক নতুন সদস্যের জন্য ঋণ অনুমোদন প্রস্তাবনা</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 font-bold flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
          >
            <ArrowLeft size={14} /> ফিরে যান
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveProposal} className="space-y-5">
        {isReadOnly && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              শাখা ব্যবস্থাপক (BM) - রিড-অনলি মোড (শুধু প্রস্তাবনা পরিদর্শন)
            </span>
            <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-black">রিড-অনলি</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Group Selection */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">১. সমিতি / গ্রুপ নির্বাচন করুন *</label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setSelectedMemberId('');
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
              required
            >
              <option value="">-- সমিতি নির্বাচন করুন --</option>
              {branchGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code}) — বৈঠক বার: {g.meetingDay || 'শনিবার'}
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Member Selection */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">২. সচল সদস্য নির্বাচন করুন *</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
              disabled={!selectedGroupId}
              required
            >
              <option value="">-- সদস্য নির্বাচন করুন --</option>
              {activeMembersInGroup.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.memberId}) {m.plOutstanding && m.plOutstanding > 0 ? `| বকেয়া: ${m.plOutstanding}৳` : ''}
                </option>
              ))}
            </select>
            {!selectedGroupId && (
              <span className="text-[10px] text-amber-600 font-semibold mt-1 block">প্রথমে একটি সমিতি সিলেক্ট করুন।</span>
            )}
          </div>
        </div>

        {/* Selected Member Mini-ledger Board */}
        {selectedMember && (
          <div className="bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 animate-in fade-in flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-slate-800 font-black text-sm">{selectedMember.name}</span>
                <span className="text-[10px] bg-slate-200 border border-slate-300 text-slate-700 px-1.5 py-0.5 rounded-md font-mono font-bold">
                  {selectedMember.memberId}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-bold space-y-0.5">
                <div>মোবাইল: <strong className="text-slate-700 font-mono">{selectedMember.phone || 'N/A'}</strong></div>
                <div>পিতা/স্বামী: <strong className="text-slate-700">{selectedMember.fatherHusbandName || 'N/A'}</strong></div>
                <div>ঠিকানা: <strong className="text-slate-700">{selectedMember.village || selectedMember.address || 'N/A'}</strong></div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-4 text-center justify-center shrink-0 min-w-full md:min-w-[200px]">
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">পূর্বের ঋণ বকেয়া</div>
                <div className={`text-xs font-black font-mono mt-0.5 ${Number(selectedMember.plOutstanding) > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {selectedMember.plOutstanding || 0} BDT
                </div>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <div className="text-[9px] text-slate-400 font-bold uppercase"> সঞ্চয় ব্যালেন্স (GS)</div>
                <div className="text-xs font-black font-mono text-emerald-600 mt-0.5">
                  {selectedMember.gsBalance ?? selectedMember.savingsBalance ?? 0} BDT
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Binding & Selection Section */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              ঋণ প্রোডাক্ট ও পলিসি নির্বাচন (কনফিগারেশন থেকে):
            </h4>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCustomConfig}
                onChange={(e) => {
                  setIsCustomConfig(e.target.checked);
                  if (!e.target.checked && selectedProduct) {
                    setInterestRate(selectedProduct.serviceChargeRate);
                    setInstallmentsCount(String(selectedProduct.installmentsCount));
                    setLoanDurationMonths(selectedProduct.durationMonths);
                    setLoanType(selectedProduct.type);
                  }
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              <span className="text-[10px] font-extrabold text-slate-600">ম্যানুয়াল এডিট করুন</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Choose pre-configured Product category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">প্রোডাক্ট ক্যাটাগরি *</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setIsCustomConfig(false);
                }}
                disabled={isCustomConfig}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {productConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.name} ({(cfg.serviceChargeRate * 100).toFixed(0)}% SC · {cfg.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom/Pre-filled Service Charge Rate */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">সার্ভিস চার্জ / সেবা ফি হাব *</label>
              <div className="relative">
                <input
                  type="number"
                  value={Math.round(interestRate * 100)}
                  onChange={(e) => setInterestRate((Number(e.target.value) || 0) / 100)}
                  disabled={!isCustomConfig}
                  className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold disabled:bg-slate-100 disabled:text-slate-605"
                  step="1"
                  min="0"
                />
                <span className="absolute right-3.5 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            {/* Service Charge calculation model selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">সার্ভিস চার্জ হিসাব পদ্ধতি</label>
              <select
                value="reducing"
                disabled={true}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-250 rounded-xl text-xs font-bold text-slate-605 cursor-not-allowed"
              >
                <option value="reducing">ক্রমহ্রাসমান পদ্ধতি (Reducing Balance Only)</option>
              </select>
            </div>

            {/* Custom/Pre-filled Installment Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">পরিশোধের ধরণ ও ফ্রিকোয়েন্সি *</label>
              <select
                value={loanType}
                onChange={(e) => {
                  const val = e.target.value as 'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি';
                  setLoanType(val);
                  
                  // Recalculate installments based on current duration and new type
                  const dur = loanDurationMonths || 12;
                  if (val === 'মেয়াদি') {
                    if (collectServiceChargeMonthly) {
                      setInstallmentsCount(String(dur));
                    } else {
                      setInstallmentsCount('1');
                    }
                  } else if (val === 'মাসিক') {
                    setInstallmentsCount(String(dur));
                  } else {
                    // Weekly
                    if (dur === 3) setInstallmentsCount('11');
                    else if (dur === 6) setInstallmentsCount('22');
                    else if (dur === 12) setInstallmentsCount('45');
                    else if (dur === 18) setInstallmentsCount('68');
                    else if (dur === 24) setInstallmentsCount('90');
                    else setInstallmentsCount(String(Math.round(dur * 3.75)));
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold bg-white"
              >
                <option value="সাপ্তাহিক">সাপ্তাহিক (Weekly)</option>
                <option value="মাসিক">মাসিক (Monthly)</option>
                <option value="মেয়াদি">মেয়াদি (Term Loan)</option>
              </select>

              {loanType === 'মেয়াদি' && (
                <div className="mt-2.5 p-3 bg-amber-50/75 border border-amber-200/70 rounded-2xl animate-in slide-in-from-top-2 duration-200 space-y-1.5 shadow-3xs text-left">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={collectServiceChargeMonthly}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCollectServiceChargeMonthly(checked);
                        if (checked) {
                          setInstallmentsCount(String(loanDurationMonths));
                        } else {
                          setInstallmentsCount('1');
                        }
                      }}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <div className="text-left">
                      <span className="text-xs font-black text-amber-900 block font-sans">মেয়াদি ঋণে মাসিক সার্ভিস চার্জ আদায়</span>
                      <span className="text-[10px] font-bold text-amber-700 block">সক্রিয় করলে আসল শেষ মাসে এবং প্রতি মাসে শুধুমাত্র সার্ভিস চার্জ আদায় করা হবে।</span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Configured Limit of installments & period */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">মেয়াদ (মাস) *</label>
                <select
                  value={loanDurationMonths}
                  onChange={(e) => {
                    const dur = Number(e.target.value);
                    setLoanDurationMonths(dur);
                    
                    if (loanType === 'মেয়াদি') {
                      if (collectServiceChargeMonthly) {
                        setInstallmentsCount(String(dur));
                      } else {
                        setInstallmentsCount('1');
                      }
                    } else if (loanType === 'মাসিক') {
                      setInstallmentsCount(String(dur));
                    } else {
                      // Weekly
                      if (dur === 3) setInstallmentsCount('11');
                      else if (dur === 6) setInstallmentsCount('22');
                      else if (dur === 12) setInstallmentsCount('45');
                      else if (dur === 18) setInstallmentsCount('68');
                      else if (dur === 24) setInstallmentsCount('90');
                      else setInstallmentsCount(String(Math.round(dur * 3.75)));
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold text-center bg-white"
                >
                  <option value={3}>৩ মাস</option>
                  <option value={6}>৬ মাস</option>
                  <option value={12}>১২ মাস</option>
                  <option value={18}>১৮ মাস</option>
                  <option value={24}>২৪ মাস</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">কিস্তি সংখ্যা *</label>
                <input
                  type="number"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Inputs section: Scheme sector, amounts, disbursement dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Loan Purpose */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">৩. ঋণের উদ্দেশ্য / খাত *</label>
            <select
              value={loanPurpose}
              onChange={(e) => setLoanPurpose(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
            >
              <option value="ক্ষুদ্র ব্যবসা">ক্ষুদ্র ব্যবসা (Retail / Small Business)</option>
              <option value="कृষি চাষাবাদ">কৃষি চাষাবাদ (Agriculture)</option>
              <option value="গাভী পালন">গাভী পালন (Cow / Livestock Rearing)</option>
              <option value="মৎস্য চাষ">মৎস্য চাষ (Fish Farming)</option>
              <option value="গৃহ সংস্কার">গৃহ সংস্কার (Home Improvement)</option>
              <option value="অন্যান্য">অন্যান্য (Others)</option>
            </select>
          </div>

          {/* Proposed Amount */}
          <div>
            <label className="block text-[11px] font-extrabold text-[#2f6ce5] uppercase mb-1 font-sans">৪. প্রস্তাবিত ঋণের পরিমাণ (টাকা) *</label>
            <input
              type="text"
              placeholder="যেমন: ২০০০০"
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 border-2 border-indigo-100 hover:border-indigo-300 focus:border-[#2f6ce5] rounded-xl text-xs font-bold outline-none font-mono focus:ring-1 focus:ring-[#2f6ce5] transition-all bg-white"
              required
            />
          </div>

          {/* Expected Disbursement Date */}
          <div>
            <label className="block text-[11px] font-extrabold text-amber-600 uppercase mb-1 flex items-center gap-1 font-sans">
              <Calendar className="w-3.5 h-3.5" />
              ৫. সম্ভাব্য বিতরণ তারিখ *
            </label>
            <input
              type="date"
              value={expectedDisburseDate}
              onChange={(e) => {
                setExpectedDisburseDate(e.target.value);
                // invalidate loaded schedule to force recalculation click
                setCalculatedSchedule(null);
                setShowScheduleResult(false);
              }}
              className="w-full px-3.5 py-2 bg-white border-2 border-amber-100 hover:border-amber-300 focus:border-amber-500 rounded-xl text-xs font-bold focus:outline-none transition-all cursor-pointer"
              required
            />
          </div>

          {/* Workspace working day info (view only) */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1">
              ৬. প্রস্তাবের তারিখ (ওর্য়াকি ডে)
              <Info className="w-3.5 h-3.5 text-[#2f6ce5]" title="বর্তমান সচল কর্মদিবস অনুযায়ী নির্ধারণ" />
            </label>
            <div className="flex items-center bg-slate-100 text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold select-none cursor-not-allowed">
              <Calendar className="w-4 h-4 text-slate-400 mr-2" />
              <span className="text-xs font-mono">{workingDay}</span>
            </div>
          </div>
        </div>

        {/* Calculation Panel & Interactive Schedule Trigger Info */}
        {principal > 0 && (
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
              <h4 className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">রিয়েল-টাইম ঋণ পরিশোধের হিসাব বিবরণী:</h4>
              
              {/* Load Schedule Interactive Button */}
              <button
                type="button"
                onClick={handleLoadSchedule}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black tracking-wide cursor-pointer shadow-sm hover:shadow transition-all flex items-center gap-1 font-sans"
              >
                <ListOrdered size={13} /> লোড সিডিউল 
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-2 rounded-xl border border-emerald-100">
                <span className="text-[9px] text-slate-400 font-bold block">ঋণের আসল</span>
                <strong className="text-xs text-slate-800 font-mono">{principal} ৳</strong>
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-100">
                <span className="text-[9px] text-slate-400 font-bold block">
                  সেবা ফি ({(interestRate * 100).toFixed(0)}% {interestMethod === 'reducing' ? 'ক্রমহ্রাসমান' : 'ফ্ল্যাট'})
                </span>
                <strong className="text-xs text-[#2f6ce5] font-mono">{simulatedInterest} ৳</strong>
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-100">
                <span className="text-[9px] text-slate-400 font-bold block">মোট পরিশোধযোগ্য</span>
                <strong className="text-xs text-emerald-700 font-mono">{totalPayable} ৳</strong>
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-100">
                <span className="text-[9px] text-slate-400 font-bold block">
                  {loanType === 'মেয়াদি' && collectServiceChargeMonthly ? 'মাসিক সার্ভিস চার্জ' : 'কিস্তির পরিমাণ (গড়ে)'}
                </span>
                <strong className="text-xs text-amber-700 font-mono">{calculatedInstallment} ৳</strong>
              </div>
            </div>

            {loanType === 'মেয়াদি' && collectServiceChargeMonthly && (
              <div className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl block text-left">
                📢 বিশেষ পরিশোধ বিন্যাস: মেয়াদি ঋণে ১ থেকে {loanDurationMonths - 1} তম কিস্তিতে প্রতি মাসে শুধুমাত্র মাসিক সার্ভিস চার্জ ({calculatedInstallment} ৳) পরিশোধ করতে হবে, এবং শেষ মাসে আসল ({principal} ৳) সহ সার্ভিস চার্জ সমন্বয় করা হবে।
              </div>
            )}
          </div>
        )}

        {/* Loaded Repayment Schedule List (gorgeous grid table representation) */}
        {showScheduleResult && calculatedSchedule && (
          <div className="bg-[#2f6ce5]/5 rounded-2xl border border-sky-100 p-4 space-y-3 animate-in fade-in duration-300">
            <div className="flex justify-between items-center border-b border-sky-200/50 pb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-[#2f6ce5]" />
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                  উৎপন্ন ঋণ পরিশোধের কিস্তি সময়সূচী (Amortization Schedule)
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setShowScheduleResult(false)}
                className="text-[10px] text-slate-405 font-bold hover:text-slate-600 px-1 hover:underline"
              >
                হাইড করুন
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto border border-sky-100 rounded-xl bg-white">
              <table className="w-full text-left border-collapse text-[10px] xs:text-[11px]">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 font-black text-slate-650 sticky top-0">
                    <th className="p-2.5 text-center">কিস্তি নং</th>
                    <th className="p-2.5">পরিশোধের তারিখ (Due Date)</th>
                    <th className="p-2.5 text-right font-sans">আসল কিস্তি</th>
                    <th className="p-2.5 text-right font-sans">সার্ভিস কিস্তি</th>
                    <th className="p-2.5 text-right font-sans bg-amber-50 text-amber-900 border-x border-amber-100">মোট কিস্তি</th>
                    <th className="p-2.5 text-right font-sans">অবশিষ্ট আসল</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                  {calculatedSchedule.map((row) => (
                    <tr key={row.installmentNo} className="hover:bg-slate-50/55">
                      <td className="p-2 text-center text-slate-500 font-mono">{row.installmentNo}</td>
                      <td className="p-2">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px] xs:text-[10px]">
                          {row.dueDate}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono text-slate-705">{row.principal} ৳</td>
                      <td className="p-2 text-right font-mono text-indigo-500">{row.interest} ৳</td>
                      <td className="p-2 text-right font-mono bg-amber-50/40 text-amber-800 border-x border-amber-100 font-extrabold">
                        {row.total} ৳
                      </td>
                      <td className="p-2 text-right font-mono text-slate-500">{row.remaining} ৳</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold px-1 pt-1 select-none">
              <span>মোট কিস্তি সংখ্যা: <strong className="text-slate-600">{installmentsCount} টি</strong></span>
              <span>বিতরণ হতে প্রথম কিস্তি পরিশোধের ধরণ: <strong className="text-[#2f6ce5]">{loanType}</strong></span>
              <span>{interestMethod === 'reducing' ? 'ক্রমহ্রাসমান' : 'ফ্ল্যাট'} মোট পরিশোধযোগ্য ঋণ: <strong className="text-emerald-700">{totalPayable} BDT</strong></span>
            </div>
          </div>
        )}

        {/* Remarks */}
        <div className="pt-1">
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">মন্তব্য (Remarks)</label>
          <textarea
            placeholder="বিশেষ তথ্য বা মন্তব্য থাকলে এখানে উল্লেখ করুন..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-250 hover:border-slate-350 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] h-18 bg-white"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="submit"
            disabled={isReadOnly}
            className={`flex-1 py-3 font-extrabold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
              isReadOnly
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                : 'bg-[#2f6ce5] hover:bg-[#1d59d1] text-white hover:shadow-lg cursor-pointer'
            }`}
          >
            <Save className="w-4 h-4" /> {isReadOnly ? 'প্রস্তাব সাবমিট নিষ্ক্রিয় (রিড-অনলি)' : 'ঋণ প্রস্তাব সাবমিট করুন'}
          </button>
        </div>
      </form>
    </div>
  );
}
