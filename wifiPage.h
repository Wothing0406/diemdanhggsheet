const char wifiPage[] PROGMEM = R"html(
<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cấu hình Wi-Fi</title><style>
body{font:16px Arial,sans-serif;background:#f4f7fb;color:#172b44;margin:0;padding:20px}
main{max-width:480px;margin:auto;background:white;border-radius:14px;padding:24px;box-shadow:0 4px 20px #172b4418}
label{display:block;margin:16px 0 6px;font-weight:bold}input,button{font:inherit;padding:10px;border:1px solid #b9c8d8;border-radius:8px;box-sizing:border-box}
input{width:100%}button{margin-top:20px;background:#1457a2;color:white;border:0;cursor:pointer}a{color:#1457a2}#result{white-space:pre-line}
</style></head><body><main><h1>Cấu hình Wi-Fi ESP32</h1>
<p>Nhập mạng Wi-Fi 2,4 GHz. Sau khi lưu, thiết bị tự khởi động lại.</p>
<form id="form"><label for="ssid">Tên mạng</label><input id="ssid" name="ssid" maxlength="32" required autocomplete="off">
<label for="password">Mật khẩu</label><input id="password" name="password" type="password" maxlength="63" autocomplete="new-password">
<button type="submit">Lưu và kết nối</button></form><p id="result"></p><a href="/">Về trang chính</a>
</main><script>
if(sessionStorage.getItem('LOGIN_STATE')!=='1') location.replace('/login');
document.getElementById('form').addEventListener('submit',async e=>{
 e.preventDefault();const result=document.getElementById('result');result.textContent='Đang lưu...';
 try{const r=await fetch('/wifi',{method:'POST',body:new URLSearchParams(new FormData(e.target))});result.textContent=await r.text();if(!r.ok)throw Error(result.textContent)}
 catch(err){result.textContent=err.message||String(err)}
});
</script></body></html>
)html";
