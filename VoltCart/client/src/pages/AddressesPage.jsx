import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/addresses')
      .then(({ addresses: list }) => setAddresses(list))
      .finally(() => setLoading(false));
  }, []);

  const makeDefault = async (id) => {
    const { addresses: list } = await api.patch(`/addresses/${id}/default`);
    setAddresses(list);
    toast.success('Default address updated');
  };

  const remove = async (id) => {
    const { addresses: list } = await api.del(`/addresses/${id}`);
    setAddresses(list);
    toast.info('Address removed');
  };

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">My addresses</h1>
        <Link to="/addresses/new" className="btn btn--primary">+ Add address</Link>
      </div>

      {addresses.length === 0 ? (
        <div className="empty">
          <h2>No addresses saved</h2>
          <p>Add a delivery address so checkout is one click away.</p>
          <Link to="/addresses/new" className="btn btn--primary">Add address</Link>
        </div>
      ) : (
        <div className="address-grid">
          {addresses.map((a) => (
            <div key={a._id} className="address address--card">
              <div className="address__head">
                <strong>{a.fullName}</strong>
                <span className="chip">{a.label}</span>
                {a.isDefault && <span className="chip chip--primary">Default</span>}
              </div>
              <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
              <p>{a.city}, {a.state} - {a.pincode}</p>
              <p className="muted">Phone: {a.phone}</p>
              <div className="address__actions">
                {!a.isDefault && <button type="button" className="link-btn" onClick={() => makeDefault(a._id)}>Set as default</button>}
                <button type="button" className="link-btn link-btn--danger" onClick={() => remove(a._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
