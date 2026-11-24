import { useEffect, useState } from 'react';

async function requestApi(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });
    const data = response.status === 204 ? null : await response.json();

    if (!response.ok) {
        const error = new Error(data?.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.riskScore = data?.riskScore ?? response.headers.get('X-Pahak-Risk');
        throw error;
    }

    return {
        data,
        riskScore: response.headers.get('X-Pahak-Risk')
    };
}

function describeRisk(mode, riskScore, action) {
    if (mode === 'unprotected') {
        return `${action}. Pahak is not attached to this route.`;
    }
    if (riskScore === null) {
        return `${action}.`;
    }
    return `${action}. Pahak risk score: ${Number(riskScore).toFixed(3)}.`;
}

export default function App() {
    const [mode, setMode] = useState('protected');
    const [items, setItems] = useState([]);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [busyDeleteId, setBusyDeleteId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const apiBase = mode === 'protected' ? '/api/items' : '/api/unprotected/items';

    useEffect(() => {
        const controller = new AbortController();
        let current = true;

        async function loadItems() {
            setLoading(true);
            setErrorMessage('');
            setStatusMessage('');
            try {
                const result = await requestApi(apiBase, { signal: controller.signal });
                if (current) {
                    setItems(result.data);
                    setStatusMessage(describeRisk(mode, result.riskScore, 'Loaded items'));
                }
            } catch (error) {
                if (current && error.name !== 'AbortError') {
                    setErrorMessage(error.message);
                }
            } finally {
                if (current) {
                    setLoading(false);
                }
            }
        }

        loadItems();
        return () => {
            current = false;
            controller.abort();
        };
    }, [apiBase, mode]);

    async function createItem(event) {
        event.preventDefault();
        setBusy(true);
        setErrorMessage('');
        try {
            const result = await requestApi(apiBase, {
                method: 'POST',
                body: JSON.stringify({ name: newName })
            });
            setItems((current) => [...current, result.data]);
            setNewName('');
            setStatusMessage(describeRisk(mode, result.riskScore, 'Created item'));
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    function beginEdit(item) {
        setEditingId(item.id);
        setEditName(item.name);
        setErrorMessage('');
    }

    async function saveEdit(item) {
        setBusy(true);
        setErrorMessage('');
        try {
            const result = await requestApi(`${apiBase}/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name: editName })
            });
            setItems((current) => current.map((entry) =>
                entry.id === item.id ? result.data : entry
            ));
            setEditingId(null);
            setStatusMessage(describeRisk(mode, result.riskScore, 'Updated item'));
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function deleteItem(item) {
        if (!window.confirm(`Delete "${item.name}"?`)) {
            return;
        }

        setBusyDeleteId(item.id);
        setErrorMessage('');
        try {
            const result = await requestApi(`${apiBase}/${item.id}`, { method: 'DELETE' });
            setItems((current) => current.filter((entry) => entry.id !== item.id));
            setStatusMessage(describeRisk(mode, result.riskScore, 'Deleted item'));
        } catch (error) {
            const riskMessage = error.riskScore
                ? ` Risk score: ${Number(error.riskScore).toFixed(3)}.`
                : '';
            setErrorMessage(`${error.message}.${riskMessage}`);
        } finally {
            setBusyDeleteId(null);
        }
    }

    return (
        <main className="page-shell">
            <header className="page-header">
                <div>
                    <p className="eyebrow">PAHAK · EXPRESS PLAYGROUND</p>
                    <h1>CRUD request lab</h1>
                    <p className="intro">
                        Compare the same ten items with Pahak protection on and off.
                    </p>
                </div>
                <span className={`mode-badge ${mode}`}>
                    {mode === 'protected' ? 'Pahak attached' : 'Pahak bypassed'}
                </span>
            </header>

            <section className="mode-panel" aria-labelledby="mode-title">
                <div>
                    <h2 id="mode-title">Choose API mode</h2>
                    <p>Each mode has its own independent copy of the ten starter items.</p>
                </div>
                <div className="mode-switch" role="group" aria-label="Pahak API mode">
                    <button
                        type="button"
                        className={mode === 'protected' ? 'selected' : ''}
                        aria-pressed={mode === 'protected'}
                        onClick={() => setMode('protected')}
                    >
                        Pahak enabled
                    </button>
                    <button
                        type="button"
                        className={mode === 'unprotected' ? 'selected' : ''}
                        aria-pressed={mode === 'unprotected'}
                        onClick={() => setMode('unprotected')}
                    >
                        Pahak disabled
                    </button>
                </div>
            </section>

            <section className="policy-note" aria-label="Delete test instructions">
                <span className="policy-icon" aria-hidden="true">!</span>
                <p>
                    Pahak compares each protected request with the actor's recent
                    action pattern. A normal delete can pass; an unusual sequence
                    of repeated deletes should be rejected. Unprotected mode skips
                    Pahak.
                </p>
            </section>

            {errorMessage && <div className="alert" role="alert">{errorMessage}</div>}
            {statusMessage && <p className="status-message" role="status">{statusMessage}</p>}

            <section className="list-panel" aria-labelledby="items-title">
                <div className="list-heading">
                    <div>
                        <p className="eyebrow">YOUR DATA</p>
                        <h2 id="items-title">Items <span>{items.length}</span></h2>
                    </div>
                    <p className="route-label">
                        {mode === 'protected' ? 'Protected API' : 'Unprotected API'}
                    </p>
                </div>

                <form className="create-form" onSubmit={createItem}>
                    <label htmlFor="new-item">Add an item</label>
                    <div className="input-row">
                        <input
                            id="new-item"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            maxLength={100}
                            placeholder="e.g. Invoice 2026"
                            required
                        />
                        <button className="primary-button" type="submit" disabled={busy}>
                            Add item
                        </button>
                    </div>
                </form>

                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">ID</th>
                                <th scope="col">Item name</th>
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="empty-row" colSpan="3">Loading items…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td className="empty-row" colSpan="3">No items yet.</td></tr>
                            ) : items.map((item) => (
                                <tr key={item.id}>
                                    <td className="id-cell">{item.id.padStart(2, '0')}</td>
                                    <td>
                                        {editingId === item.id ? (
                                            <input
                                                className="edit-input"
                                                value={editName}
                                                onChange={(event) => setEditName(event.target.value)}
                                                maxLength={100}
                                                aria-label={`Edit item ${item.id}`}
                                            />
                                        ) : item.name}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            {editingId === item.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="text-button"
                                                        disabled={busy}
                                                        onClick={() => saveEdit(item)}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-button muted"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    disabled={busy}
                                                    onClick={() => beginEdit(item)}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="delete-button"
                                                disabled={busy || busyDeleteId !== null}
                                                onClick={() => deleteItem(item)}
                                            >
                                                {busyDeleteId === item.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <footer className="list-footer">
                    <span>{items.length} {items.length === 1 ? 'item' : 'items'} in this mode</span>
                    <span>Confirm each delete to send a request</span>
                </footer>
            </section>
            <p className="footer-note">
                Demo only · Protected and unprotected data stores are separate.
            </p>
        </main>
    );
}
