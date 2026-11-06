const char loginPage[] PROGMEM = R"html(
<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Đăng nhập ESP32</title><style>
body{font:16px Arial,sans-serif;background:#f4f7fb;color:#172b44;margin:0;padding:20px}main{max-width:440px;margin:auto;background:white;border-radius:14px;padding:24px;box-shadow:0 4px 20px #172b4418}
label{display:block;margin:14px 0 6px;font-weight:bold}input,button{font:inherit;padding:10px;border:1px solid #b9c8d8;border-radius:8px;box-sizing:border-box}input{width:100%}
button{background:#1457a2;color:white;border:0;cursor:pointer;margin:14px 8px 0 0}.danger{background:#ad3842}#accounts{padding-left:20px}#message{white-space:pre-line;color:#ad3842}
</style></head><body><main><h1>Đăng nhập thiết bị</h1>
<section id="login"><form id="loginForm"><label for="username">Tên đăng nhập</label><input id="username" autocomplete="username" required>
<label for="password">Mật khẩu</label><input id="password" type="password" autocomplete="current-password" required>
<button type="submit">Đăng nhập</button></form></section>
<section id="manage" hidden><p>Quản lý tài khoản trên ESP32. Thêm lại tên cũ để đổi mật khẩu.</p>
<ul id="accounts"></ul><form id="accountForm"><label for="newUsername">Tên đăng nhập</label><input id="newUsername" maxlength="32" required>
<label for="newPassword">Mật khẩu mới</label><input id="newPassword" type="password" minlength="8" required>
<button type="submit">Lưu tài khoản</button><button type="button" class="danger" id="delete">Xóa tài khoản</button></form>
<p><a href="/">Về trang chính</a></p></section><p id="message" role="status"></p></main><script>
const $=id=>document.getElementById(id);
async function post(url,values){const r=await fetch(url,{method:'POST',body:new URLSearchParams(values)}),t=await r.text();if(!r.ok)throw Error(t);return t}
async function loadAccounts(){const r=await fetch('/getLogin');if(!r.ok)throw Error('Phiên đăng nhập đã hết');const names=Object.keys(await r.json());$('accounts').replaceChildren();for(const name of names){const li=document.createElement('li');li.textContent=name;li.onclick=()=>$('newUsername').value=name;$('accounts').append(li)}}
async function showManage(){try{await loadAccounts();$('login').hidden=true;$('manage').hidden=false}catch{sessionStorage.removeItem('LOGIN_STATE');$('login').hidden=false;$('manage').hidden=true}}
if(sessionStorage.getItem('LOGIN_STATE')==='1')showManage();
$('loginForm').onsubmit=async e=>{e.preventDefault();$('message').textContent='';try{await post('/checkLogin',{username:$('username').value,password:$('password').value});sessionStorage.setItem('LOGIN_STATE','1');location.assign('/')}catch(err){$('message').textContent=err.message}};
$('accountForm').onsubmit=async e=>{e.preventDefault();$('message').textContent='';try{await post('/addLogin',{username:$('newUsername').value,password:$('newPassword').value});$('newPassword').value='';await loadAccounts();$('message').textContent='Đã lưu tài khoản.'}catch(err){$('message').textContent=err.message}};
$('delete').onclick=async()=>{const username=$('newUsername').value;if(!username||!confirm('Xóa tài khoản '+username+'?'))return;try{await post('/deleteLogin',{username});await loadAccounts();$('message').textContent='Đã xóa tài khoản.'}catch(err){$('message').textContent=err.message}};
</script></body></html>
)html";
