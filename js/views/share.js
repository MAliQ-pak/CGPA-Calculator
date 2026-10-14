// "Share my result": a preview of the result card with download and share buttons.
import { store } from '../store.js';
import { overallTotals, history, maxGP } from '../calc.js';
import { el, icon, openDialog, toast } from '../ui.js';
import { drawResultCard, loadCardFonts } from '../card.js';

const prefs = { showName: true, showChart: true };

export function openShareDialog() {
  openDialog({
    title: 'Share your result',
    wide: true,
    build: (close) => {
      const canvas = el('canvas', { class: 'card-preview', role: 'img', 'aria-label': 'Preview of your result card' });
      const opts = () => {
        const t = overallTotals(store.data);
        return {
          name: store.user.name,
          program: store.data.program.name,
          university: store.data.profile.university,
          cgpa: t.cgpa,
          credits: t.credits,
          max: maxGP(store.data),
          rows: history(store.data),
          showName: prefs.showName,
          showChart: prefs.showChart,
          link: `${location.host}${location.pathname.replace(/\/$/, '')}`,
        };
      };
      const redraw = () => drawResultCard(canvas, opts());

      const toggle = (key, label) => {
        const box = el('input', { type: 'checkbox', checked: prefs[key] });
        box.addEventListener('change', () => {
          prefs[key] = box.checked;
          redraw();
        });
        return el('label', { class: 'check-row compact' }, box, el('span', {}, label));
      };

      const fileName = 'gradepoint-result.png';
      const toBlob = () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const download = async () => {
        const blob = await toBlob();
        const a = el('a', { href: URL.createObjectURL(blob), download: fileName });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Image saved', 'success');
      };
      const share = async () => {
        const file = new File([await toBlob()], fileName, { type: 'image/png' });
        try {
          await navigator.share({ files: [file], title: 'My CGPA', text: 'Made with GradePoint' });
        } catch (e) {
          if (e.name !== 'AbortError') download();
        }
      };
      const canShareFiles = Boolean(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));

      loadCardFonts().then(redraw);
      redraw();

      return el('div', { class: 'share-dialog' },
        el('div', { class: 'share-preview' }, canvas),
        el('div', { class: 'share-side' },
          el('p', { class: 'muted small' }, 'A card with your CGPA for WhatsApp, Instagram or anywhere else. Only what you see here is in the image.'),
          toggle('showName', 'Show my name'),
          toggle('showChart', 'Show semester GPAs'),
          el('div', { class: 'share-buttons' },
            canShareFiles ? el('button', { type: 'button', class: 'btn btn-primary', onclick: share }, icon('share', 18), 'Share image') : null,
            el('button', { type: 'button', class: canShareFiles ? 'btn btn-ghost' : 'btn btn-primary', onclick: download }, icon('download', 18), 'Download image'),
            el('a', { href: '#/report', class: 'btn btn-ghost', onclick: () => close() }, icon('book', 18), 'PDF summary'),
          ),
        ),
      );
    },
  });
}
