'use client';

import React, { createContext, useContext, useState } from 'react';
import type { 
  Document, 
  Machine, 
  Collection, 
  Employee, 
  Payroll,
  DashboardStats 
} from '@/lib/types';
import {
  mockDocuments,
  mockMachines,
  mockCollections,
  mockEmployees,
  mockPayrolls,
} from '@/lib/mock-data';

interface DataContextType {
  // Documents
  documents: Document[];
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  
  // Machines
  machines: Machine[];
  addMachine: (machine: Machine) => void;
  updateMachine: (id: string, updates: Partial<Machine>) => void;
  
  // Collections
  collections: Collection[];
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  
  // Employees
  employees: Employee[];
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  
  // Payrolls
  payrolls: Payroll[];
  addPayroll: (payroll: Payroll) => void;
  updatePayroll: (id: string, updates: Partial<Payroll>) => void;
  
  // Dashboard stats
  getDashboardStats: () => DashboardStats;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [machines, setMachines] = useState<Machine[]>(mockMachines);
  const [collections, setCollections] = useState<Collection[]>(mockCollections);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [payrolls, setPayrolls] = useState<Payroll[]>(mockPayrolls);

  // Documents
  const addDocument = (doc: Document) => {
    setDocuments(prev => [...prev, doc]);
  };

  const updateDocument = (id: string, updates: Partial<Document>) => {
    setDocuments(prev =>
      prev.map(doc => (doc.id === id ? { ...doc, ...updates } : doc))
    );
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  // Machines
  const addMachine = (machine: Machine) => {
    setMachines(prev => [...prev, machine]);
  };

  const updateMachine = (id: string, updates: Partial<Machine>) => {
    setMachines(prev =>
      prev.map(machine => (machine.id === id ? { ...machine, ...updates } : machine))
    );
  };

  // Collections
  const addCollection = (collection: Collection) => {
    setCollections(prev => [...prev, collection]);
  };

  const updateCollection = (id: string, updates: Partial<Collection>) => {
    setCollections(prev =>
      prev.map(collection => (collection.id === id ? { ...collection, ...updates } : collection))
    );
  };

  // Employees
  const addEmployee = (employee: Employee) => {
    setEmployees(prev => [...prev, employee]);
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev =>
      prev.map(employee => (employee.id === id ? { ...employee, ...updates } : employee))
    );
  };

  // Payrolls
  const addPayroll = (payroll: Payroll) => {
    setPayrolls(prev => [...prev, payroll]);
  };

  const updatePayroll = (id: string, updates: Partial<Payroll>) => {
    setPayrolls(prev =>
      prev.map(payroll => (payroll.id === id ? { ...payroll, ...updates } : payroll))
    );
  };

  // Dashboard stats
  const getDashboardStats = (): DashboardStats => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return {
      activeMachines: machines.filter(m => m.status === 'ACTIVA').length,
      pendingReviewDocuments: documents.filter(d => d.statusReview === 'PENDIENTE').length,
      pendingAccountingDocuments: documents.filter(d => d.statusAccounting === 'PENDIENTE').length,
      monthlyRevenue: collections
        .filter(c => {
          const date = new Date(c.date);
          return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum, c) => sum + c.totalAmount, 0),
      monthlyPayrolls: payrolls.filter(p => p.month === currentMonth && p.year === currentYear).length,
    };
  };

  return (
    <DataContext.Provider
      value={{
        documents,
        addDocument,
        updateDocument,
        deleteDocument,
        machines,
        addMachine,
        updateMachine,
        collections,
        addCollection,
        updateCollection,
        employees,
        addEmployee,
        updateEmployee,
        payrolls,
        addPayroll,
        updatePayroll,
        getDashboardStats,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
