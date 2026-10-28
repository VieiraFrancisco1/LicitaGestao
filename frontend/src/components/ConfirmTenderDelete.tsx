import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import type { Tender } from '../types';

export function ConfirmTenderDelete({ tender, pending, error, onClose, onConfirm }: {
  tender: Tender;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Excluir licitação?" eyebrow="Confirmação" onClose={onClose}>
      <div className="tender-delete-confirmation">
        <p>Deseja excluir <strong>{tender.municipality || 'esta licitação'}{tender.noticeNumber ? ` · Nº ${tender.noticeNumber}` : ''}</strong>?</p>
        <p>As participações e os registros vinculados também serão excluídos.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Cancelar</button>
          <button type="button" className="primary-button tender-delete-button" disabled={pending} onClick={onConfirm}>
            <Trash2 size={16} /> {pending ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
