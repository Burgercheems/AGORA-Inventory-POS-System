import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Modal from '../ui/Modal';
import type { Supplier } from '../../types/inventory';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  supplier: Supplier | null;
}

export default function SupplierFormModal({ isOpen, onClose, onSave, supplier }: SupplierFormModalProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(supplier?.name ?? '');
    setContact(supplier?.contact ?? '');
    setAddress(supplier?.address ?? '');
    setErrors({});
  }, [supplier, isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Supplier name is required';
    if (!contact.trim()) next.contact = 'Contact info is required';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSave({ id: supplier?.id ?? `sup-${Date.now()}`, name, contact, address });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={supplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Supplier name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="e.g. Coca-Cola Philippines"
          />
          {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Contact number</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="e.g. +63 917 123 4567"
          />
          {errors.contact && <p className="mt-1 text-xs text-rose-600">{errors.contact}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {supplier ? 'Save changes' : 'Add supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}