// Small overlay used by the grown-up to add or edit a person (name, photo, recorded name).
import * as people from './people';
import { pick, shrinkToDataUrl } from './photos';
import { h, t } from './ui';

export function openPersonDialog(existing: people.Person | null, onDone: () => void): void {
  let photo = existing?.photo ?? '';
  let voice: Blob | undefined = existing?.voice;
  let recorder: { stop: () => void; done: Promise<Blob | null> } | null = null;

  const nameInput = h('input', { class: 'p-name', type: 'text', maxlength: '30', placeholder: t('personName'), value: existing?.name ?? '' });
  const preview = h('img', { class: 'p-preview', alt: '', src: photo || undefined, hidden: !photo });
  const photoBtn = h('button', { class: 'p-btn', type: 'button' }, '📷 ', t('choosePhoto'));
  const recBtn = h('button', { class: 'p-btn', type: 'button', hidden: !people.canRecord() }, '🎤 ', voice ? t('recorded') : t('recordName'));
  const error = h('p', { class: 'p-error', hidden: true }, t('needPhoto'));
  const saveBtn = h('button', { class: 'p-btn p-save', type: 'button' }, t('save'));
  const cancelBtn = h('button', { class: 'p-btn', type: 'button' }, t('cancel'));
  const deleteBtn = h('button', { class: 'p-btn p-delete', type: 'button', hidden: !existing }, t('delete'));

  const box = h(
    'div',
    { class: 'p-box', role: 'dialog', 'aria-modal': 'true' },
    h('h2', { class: 'p-title' }, existing ? existing.name : t('addPerson')),
    preview,
    nameInput,
    photoBtn,
    recBtn,
    error,
    h('div', { class: 'p-actions' }, cancelBtn, deleteBtn, saveBtn),
  );
  const overlay = h('div', { class: 'p-overlay' }, box);
  document.body.append(overlay);
  nameInput.focus();

  const close = (): void => {
    recorder?.stop();
    overlay.remove();
  };

  photoBtn.addEventListener('click', async () => {
    const file = await pick();
    if (!file) return;
    photo = await shrinkToDataUrl(file);
    preview.src = photo;
    preview.hidden = false;
  });

  recBtn.addEventListener('click', async () => {
    if (recorder) {
      recorder.stop();
      return;
    }
    try {
      recBtn.textContent = `🎤 ${t('recording')}`;
      recBtn.classList.add('p-recording');
      recorder = await people.record(() => {
        recBtn.classList.remove('p-recording');
        recorder = null;
      });
      const blob = await recorder.done;
      if (blob) voice = blob;
      recBtn.textContent = `🎤 ${voice ? t('recorded') : t('recordName')}`;
    } catch {
      recorder = null;
      recBtn.classList.remove('p-recording');
      recBtn.textContent = `🎤 ${t('recordName')}`;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name || !photo) {
      error.hidden = false;
      return;
    }
    await people.save({ id: existing?.id, name, photo, voice });
    close();
    onDone();
  });

  deleteBtn.addEventListener('click', async () => {
    if (existing) await people.remove(existing.id);
    close();
    onDone();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
