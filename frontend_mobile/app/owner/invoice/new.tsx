import React from 'react';
import InvoiceGenerate from '@/roles/shared/invoices/InvoiceGenerate';

export default function OwnerInvoiceNewRoute() {
  return <InvoiceGenerate basePath="/owner/invoice" />;
}
