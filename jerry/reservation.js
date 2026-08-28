(() => {
  const card = document.querySelector('.reservation-card');
  if (!card) return;

  const LINE_ID = '@882npfrm';
  const lineMessageUrl = (message) => `https://line.me/R/oaMessage/${encodeURIComponent(LINE_ID)}/?${encodeURIComponent(message)}`;

  const style = document.createElement('style');
  style.textContent = `
    .jerry-reservation-form{display:grid;gap:14px;margin-top:18px}
    .jerry-reservation-form label{display:grid;gap:7px;font-size:13px;font-weight:800;color:#4b5563}
    .jerry-reservation-form input{width:100%;box-sizing:border-box;border:0;border-radius:20px;background:#f1f3f6;color:#111827;padding:17px 18px;font:inherit;font-size:16px;outline:none}
    .jerry-reservation-form input:focus{box-shadow:0 0 0 3px rgba(8,105,223,.18)}
    .jerry-reservation-note{margin:2px 0 0;color:#7b8492;font-size:14px;line-height:1.65}
    .jerry-reservation-submit{border:0;cursor:pointer;margin-top:6px}
    .jerry-reservation-status{min-height:20px;margin:0;font-size:13px;font-weight:700;color:#0869df}
  `;
  document.head.appendChild(style);

  card.innerHTML = `
    <b>預約時留下</b>
    <form id="jerryReservationForm" class="jerry-reservation-form" novalidate>
      <label>日期／時段<input id="reservationDateTime" type="datetime-local" required></label>
      <label>貴姓<input id="reservationSurname" type="text" maxlength="20" placeholder="例如：陳先生／陳小姐" required></label>
      <label>手機<input id="reservationPhone" type="tel" inputmode="numeric" maxlength="10" placeholder="09xxxxxxxx" required></label>
      <label>車牌<input id="reservationPlate" type="text" maxlength="12" placeholder="例如：ABC-1234" required></label>
      <p class="jerry-reservation-note">送出後會直接開啟傑瑞官方 LINE，預約內容會自動帶入，您只要按傳送即可。</p>
      <p id="reservationStatus" class="jerry-reservation-status" aria-live="polite"></p>
      <button class="btn btn-black full-btn jerry-reservation-submit" type="submit">送出預約 → LINE</button>
    </form>`;

  const form = document.querySelector('#jerryReservationForm');
  const dateTime = document.querySelector('#reservationDateTime');
  const surname = document.querySelector('#reservationSurname');
  const phone = document.querySelector('#reservationPhone');
  const plate = document.querySelector('#reservationPlate');
  const status = document.querySelector('#reservationStatus');

  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  dateTime.min = localNow;

  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/\D/g, '').slice(0, 10);
  });
  plate.addEventListener('input', () => {
    plate.value = plate.value.toUpperCase().replace(/\s+/g, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = {
      dateTime: dateTime.value.trim(),
      surname: surname.value.trim(),
      phone: phone.value.trim(),
      plate: plate.value.trim()
    };

    if (!values.dateTime || !values.surname || !values.phone || !values.plate) {
      status.textContent = '請先把四個欄位填完整。';
      return;
    }
    if (!/^09\d{8}$/.test(values.phone)) {
      status.textContent = '手機請輸入 09 開頭的 10 碼號碼。';
      phone.focus();
      return;
    }

    const formattedDate = values.dateTime.replace('T', ' ');
    const message = [
      '【網站預約】',
      `日期／時段：${formattedDate}`,
      `貴姓：${values.surname}`,
      `手機：${values.phone}`,
      `車牌：${values.plate}`,
      '',
      '麻煩店家協助確認預約，謝謝。'
    ].join('\n');

    try { await navigator.clipboard?.writeText(message); } catch (_) {}
    status.textContent = '已整理預約內容，正在開啟官方 LINE…';
    window.location.href = lineMessageUrl(message);
  });
})();
