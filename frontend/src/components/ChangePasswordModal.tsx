import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../services/api';
import { Modal } from './Modal';

export function ChangePasswordModal({
  onClose,
  onPasswordChanged
}: {
  onClose: () => void;
  onPasswordChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setWorking(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      setSuccess('Senha alterada com segurança. Você será direcionado para entrar novamente.');
      window.setTimeout(onPasswordChanged, 1600);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      title="Alterar minha senha"
      eyebrow="Segurança da conta"
      onClose={success ? onPasswordChanged : onClose}
    >
      {success ? (
        <div className="password-change-success">
          <span><ShieldCheck size={28} /></span>
          <div>
            <strong>Senha atualizada</strong>
            <p>{success}</p>
          </div>
        </div>
      ) : (
        <form className="entity-form password-change-form" onSubmit={(event) => void submit(event)}>
          <p className="password-change-intro full">
            Confirme sua senha atual e escolha uma nova senha com pelo menos 12 caracteres.
          </p>
          {error && <div className="alert alert-error full">{error}</div>}
          <label className="full">
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <label className="full">
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <small className="field-help">Use uma frase longa que não seja utilizada em outros serviços.</small>
          </label>
          <label className="full">
            Confirmar nova senha
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <div className="form-actions full">
            <button className="secondary-button" type="button" onClick={onClose} disabled={working}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={working}>
              <KeyRound size={17} />
              {working ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
