"use client";
import React, { createContext, useContext, useState } from "react";

const AlertContext = createContext(undefined); // note explicit undefined

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  console.log("✅ AlertProvider mounted");
  const [alert, setAlert] = useState({ data: null, type: "", visible: false });

  const showAlert = (data, type) => setAlert({ data, type, visible: true });
  const hideAlert = () => setAlert((a) => ({ ...a, visible: false }));

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
};