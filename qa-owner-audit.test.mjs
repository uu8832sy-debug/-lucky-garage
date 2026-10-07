import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync('public/multi-shop-core.js', 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
const auditSource = fs.readFileSync('public/admin/audit-log.js', 'utf8')
  .replace(/^import .*;\n/gm, '');
const owner = { uid:'primary', email:'uu8832sr@gmail.com', emailVerified:true };
function core(account = {}) {
  const context = vm.createContext({
    URLSearchParams, console,
    doc:(_db, ...parts) => parts.join('/'),
    getDoc:async () => ({ exists:() => true, data:() => account })
  });
  vm.runInContext(coreSource, context);
  return context;
}
function audit(user, read) {
  const body = { innerHTML:'previous private data', replaceChildren(){this.innerHTML='';} };
  const status = { textContent:'' };
  const auth = { currentUser:user };
  let callback;
  const context = vm.createContext({
    console:{...console,error(){}}, URLSearchParams, window:{}, location:{},
    document:{querySelector:s => s === '#auditBody' ? body : status},
    initializeApp:() => ({}), getAuth:() => auth, getFirestore:() => ({}),
    collectionGroup:(_db, name) => ({name}), collection:(_db, ...parts) => ({path:parts.join("/")}), getDocs:read,
    isPrimaryOwner:core().isPrimaryOwner,
    onAuthStateChanged:(_auth, cb) => {callback=cb;}
  });
  vm.runInContext(auditSource, context);
  return { callback, body, status, auth };
}

test('Only verified primary Gmail is the platform owner', () => {
  const c = core();
  assert.equal(c.isPrimaryOwner(owner), true);
  for (const user of [null, {...owner,emailVerified:false}, {...owner,isAnonymous:true},
    {uid:'admin',email:'other@gmail.com',emailVerified:true,role:'platformOwner'}]) {
    assert.equal(c.isPrimaryOwner(user), false);
  }
});

test('Missing or foreign platform role cannot acquire an admin context', async () => {
  for (const role of [undefined, '', 'platformOwner', 'unknown']) {
    const c=core({enabled:true,shopId:'xiaoyu',role});
    await assert.rejects(c.resolveShopContext({}, {uid:'employee',email:'employee@example.com'}));
  }
  const c=core({enabled:true,shopId:'xiaoyu',role:'staff'});
  assert.equal((await c.resolveShopContext({}, {uid:'employee',email:'employee@example.com'})).role, 'staff');
});

test('Other administrators and staff never request private audit data', async () => {
  for (const user of [null, {...owner,emailVerified:false},
    {uid:'legacy-admin',email:'other@example.com',emailVerified:true},
    {uid:'staff',email:'staff@example.com',emailVerified:true}]) {
    let reads=0;
    const page=audit(user, async () => {reads++; throw Error('unexpected read');});
    await page.callback(user);
    assert.equal(reads, 0);
    assert.ok(!page.body.innerHTML.includes('previous private data'));
  }
});

test('Owner sees all shops with the shop derived from the document path', async () => {
  const page=audit(owner, async query => {
    assert.equal(query.name, 'auditLogs');
    return {docs:[{id:'record',ref:{path:'shops/jerry/auditLogs/record'},data:() =>
      ({shopId:'forged',actorEmail:'employee@example.com',action:'update_product'})}]};
  });
  await page.callback(owner);
  assert.match(page.body.innerHTML, /jerry/);
  assert.ok(!page.body.innerHTML.includes('forged'));
  assert.match(page.status.textContent, /全平台/);
});

test('An in-flight owner read cannot display after signing out', async () => {
  let finish;
  const page=audit(owner, () => new Promise(resolve => {finish=resolve;}));
  const pending=page.callback(owner);
  page.auth.currentUser=null;
  await page.callback(null);
  finish({docs:[{id:'private',data:() => ({actorEmail:'private-owner-data'})}]});
  await pending;
  assert.ok(!page.body.innerHTML.includes('private-owner-data'));
});


test('Owner retains access while older deployed rules require per-shop queries', async () => {
  const seen=[];
  const page=audit(owner, async query => {
    if(query.name) throw Object.assign(Error('old rules'), {code:'permission-denied'});
    seen.push(query.path);
    if(query.path==='shops') return {docs:[{id:'jerry'}]};
    return {docs:[]};
  });
  await page.callback(owner);
  assert.deepEqual(seen, ['shops', 'auditLogs', 'shops/jerry/auditLogs']);
  assert.match(page.status.textContent, /尚無操作紀錄/);
});
