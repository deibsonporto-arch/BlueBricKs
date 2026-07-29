import { useState } from 'react';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { exportBackup, importBackup } from '../../utils/backup';
import './BackupModal.css';

interface BackupModalProps {
  open: boolean;
  onClose: () => void;
}

export function BackupModal({ open, onClose }: BackupModalProps) {
  const [arquivoPendente, setArquivoPendente] = useState<File | undefined>(undefined);
  const [erro, setErro] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) { setErro(''); setArquivoPendente(file); }
  }

  function handleExportar() {
    setErro('');
    exportBackup().catch((err) => {
      console.error('Erro ao gerar backup:', err);
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o backup.');
    });
  }

  async function handleConfirmarRestauracao() {
    if (!arquivoPendente) return;
    try {
      await importBackup(arquivoPendente);
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao restaurar backup.');
      setArquivoPendente(undefined);
    }
  }

  return (
    <>
      <Modal open={open} title="Backup dos dados" onClose={onClose} width={520}>
        <p className="backup-modal__intro">
          Todos os dados do BlueBRICKs (obras, fornecedores, lançamentos, anexos, etc.) ficam salvos só no armazenamento local
          deste navegador — não existe nuvem nem servidor. Se limpar os dados do navegador ou trocar de computador, tudo se perde.
          Baixe um backup periodicamente para não correr esse risco.
        </p>

        <div className="backup-modal__actions">
          <button type="button" className="btn btn-primary" onClick={handleExportar}>
            <IconDownload size={16} /> Baixar backup
          </button>
          <label className="btn btn-secondary backup-modal__upload-btn">
            <IconUpload size={16} /> Restaurar backup
            <input type="file" accept="application/json" onChange={handleFileChange} hidden />
          </label>
        </div>

        {erro && <p className="backup-modal__erro">{erro}</p>}
      </Modal>

      <ConfirmDialog
        open={!!arquivoPendente}
        title="Restaurar backup"
        message={`Isso vai substituir TODOS os dados atuais do app pelo conteúdo de "${arquivoPendente?.name}". Essa ação não pode ser desfeita. Deseja continuar?`}
        confirmLabel="Restaurar"
        danger
        onCancel={() => setArquivoPendente(undefined)}
        onConfirm={handleConfirmarRestauracao}
      />
    </>
  );
}
