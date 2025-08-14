
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Device } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// These functions are no longer needed as the API provides export endpoints.
// Keeping them here for reference or if local export functionality is desired later.

export function exportToJson(data: Device[]) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const link = document.createElement("a");
  link.href = jsonString;
  link.download = "devices.json";
  link.click();
}

export function exportToCsv(data: Device[]) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), 
    ...data.map(row => 
      headers.map(fieldName => 
        JSON.stringify(row[fieldName as keyof Device], (key, value) => value === null ? '' : value)
      ).join(',')
    )
  ];
  
  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "devices.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
