import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuthStore } from '../../stores/useAuthStore'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER'

interface User {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
}

interface FormState {
  name: string
  email: string
  password: string
  role: Role
}

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']

const ROLE_STYLE: Record<Role, { bg: string; color: string }> = {
  SUPER_ADMIN: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  ADMIN:       { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  MANAGER:     { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  CASHIER:     { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
}

const card: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#f59e0b', border: 'none', borderRadius: 8,
  color: '#0f172a', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', border: '1px solid #334155',
  borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
}

export default function UsersPage() {
  const { user: me } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', email: '', password: '', role: 'CASHIER' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Only SUPER_ADMIN can see/assign the SUPER_ADMIN role
  const availableRoles = ROLES.filter((r) => me?.role === 'SUPER_ADMIN' || r !== 'SUPER_ADMIN')

  const load = async () => {
    try {
      const res = await api.get('/users')
      setUsers(Array.isArray(res.data) ? res.data : res.data?.data ?? [])
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    // Default role to CASHIER; if current user is not SUPER_ADMIN, SUPER_ADMIN is not an option anyway
    setForm({ name: '', email: '', password: '', role: 'CASHIER' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    // Only SUPER_ADMIN can edit another SUPER_ADMIN
    if (u.role === 'SUPER_ADMIN' && me?.role !== 'SUPER_ADMIN') return
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) {
      setError('Name, email, and password are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role }
      if (form.password) payload.password = form.password
      if (editing) {
        const res = await api.put(`/users/${editing.id}`, payload)
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? res.data : u)))
      } else {
        const res = await api.post('/users', payload)
        setUsers((prev) => [res.data, ...prev])
      }
      setModalOpen(false)
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (u: User) => {
    try {
      const res = await api.patch(`/users/${u.id}/status`)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)))
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Failed to update status.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>Users</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Manage system accounts and roles.</p>
        </div>
        <button onClick={openCreate} style={btnPrimary}>+ Add User</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {ROLES.map((role) => {
          const count = users.filter((u) => u.role === role).length
          const s = ROLE_STYLE[role]
          return (
            <div key={role} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#64748b' }}>
                {role.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rs = ROLE_STYLE[u.role]
                const isMe = u.id === me?.id
                const isSuperAdmin = u.role === 'SUPER_ADMIN'
                const canEdit = !isSuperAdmin || me?.role === 'SUPER_ADMIN'
                // Cannot deactivate yourself, and cannot deactivate a Super Admin unless you are one
                const canToggle = !isMe && (!isSuperAdmin || me?.role === 'SUPER_ADMIN')
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid #334155' }}>
                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        {u.name} {isMe && <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>(you)</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: 13 }}>{u.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: rs.bg, color: rs.color }}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: u.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)', color: u.is_active ? '#34d399' : '#64748b' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569', fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString('en-PH')}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {canEdit && (
                          <button onClick={() => openEdit(u)} style={{ ...btnGhost, padding: '6px 14px', fontSize: 12 }}>Edit</button>
                        )}
                        {canToggle && (
                          <button
                            onClick={() => handleToggle(u)}
                            style={{ ...btnGhost, padding: '6px 14px', fontSize: 12, color: u.is_active ? '#f87171' : '#34d399', borderColor: u.is_active ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)' }}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw' }}>
            <h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: '0 0 20px' }}>
              {editing ? 'Edit User' : 'Add User'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Juan Dela Cruz' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'juan@agora.com' },
                { label: editing ? 'New Password (leave blank to keep)' : 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} style={inputStyle}>
                  {availableRoles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>

              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setModalOpen(false)} style={btnGhost}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}