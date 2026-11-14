const notices = {
  tutoring: ['RFP 27-041', 'Northbank is seeking a tutoring platform with course-level reporting and instructor controls.'],
  classroom: ['RFP 27-059', 'Cedar Valley is seeking classroom response tools for in-person and hybrid courses.'],
  assessment: ['RFP 26-118', 'Awarded to the fictional Harborline Learning. The sample award notice lists $84,000.'],
  analytics: ['RFP 26-103', 'The response period ended. This sample record has no published award notice.'],
};

const filter = document.querySelector('#status');
const rows = [...document.querySelectorAll('.notices li')];
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty');
const dialog = document.querySelector('#notice-detail');
let opener;

function applyFilter() {
  let visible = 0;
  for (const row of rows) {
    row.hidden = filter.value !== 'all' && row.dataset.status !== filter.value;
    if (!row.hidden) visible += 1;
  }
  count.textContent = visible === 1 ? '1 notice' : `${visible} notices`;
  empty.hidden = visible !== 0;
}

filter.addEventListener('change', applyFilter);
document.querySelector('#reset-filter').addEventListener('click', () => {
  filter.value = 'all';
  applyFilter();
  filter.focus();
});

for (const button of document.querySelectorAll('[data-notice]')) {
  button.addEventListener('click', () => {
    const [reference, copy] = notices[button.dataset.notice];
    document.querySelector('#notice-ref').textContent = reference;
    document.querySelector('#notice-title').textContent = button.closest('li').querySelector('h3').textContent;
    document.querySelector('#notice-copy').textContent = copy;
    opener = button;
    dialog.showModal();
  });
  button.hidden = false;
}

dialog.addEventListener('close', () => opener?.focus());
document.querySelector('#filters').hidden = false;
