const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const OWNER_EMAIL = 'uu8832sr@gmail.com';

async function assertPlatformOwner(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '請先登入管理員帳號');

  const email = String(request.auth.token.email || '').toLowerCase();
  if (request.auth.token.email_verified === true && email === OWNER_EMAIL) return;

  const accountSnap = await admin.firestore().collection('adminAccounts').doc(request.auth.uid).get();
  if (accountSnap.exists && accountSnap.data()?.enabled === true && accountSnap.data()?.role === 'platformOwner') return;

  throw new HttpsError('permission-denied', '只有平台管理員可以新增代理店');
}

function normalizeShopId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

exports.createShopAdmin = onCall({ region: 'asia-east1' }, async (request) => {
  await assertPlatformOwner(request);

  const name = String(request.data?.name || '').trim();
  const shopId = normalizeShopId(request.data?.shopId || name);
  const email = String(request.data?.email || '').trim().toLowerCase();
  const password = String(request.data?.password || '');

  if (!name) throw new HttpsError('invalid-argument', '請輸入店家名稱');
  if (!/^[a-z0-9-]{2,40}$/.test(shopId)) throw new HttpsError('invalid-argument', 'shopId 格式不正確');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'Email 格式不正確');
  if (password.length < 8) throw new HttpsError('invalid-argument', '密碼至少 8 碼');

  const db = admin.firestore();
  const shopRef = db.collection('shops').doc(shopId);
  const existingShop = await shopRef.get();
  if (existingShop.exists) throw new HttpsError('already-exists', '這個 shopId 已存在');

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, emailVerified: true, disabled: false });
  } catch (error) {
    const code = String(error?.code || '');
    if (code.includes('email-already-exists')) throw new HttpsError('already-exists', '這個 Email 已經有 Firebase 帳號');
    throw new HttpsError('internal', error?.message || '建立 Firebase 帳號失敗');
  }

  try {
    const batch = db.batch();
    batch.set(shopRef, {
      name,
      displayName: name,
      enabled: true,
      public: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid
    });
    batch.set(db.collection('adminAccounts').doc(userRecord.uid), {
      enabled: true,
      shopId,
      role: 'admin',
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid
    });
    await batch.commit();
  } catch (error) {
    await admin.auth().deleteUser(userRecord.uid).catch(() => {});
    throw new HttpsError('internal', error?.message || '建立店家資料失敗');
  }

  return { ok: true, uid: userRecord.uid, shopId, name, email };
});
