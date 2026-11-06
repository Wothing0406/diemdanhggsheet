const char userPage[] PROGMEM = R"html(
<!DOCTYPE html>
  <html>
  <head>
      <meta name="viewport" content="width=device-width,user-scalable=0"  charset="utf-8">
      <title>Danh sách</title>
      <style type="text/css">
      	#main{
      		margin: 10px auto;
      	}
      	h1{
      		color: red;
          font-size: 26px;
      	}
      	input[type="button"]{
      		width: 300px;
      		height: 40px;
      	}
      	#danhsach{
          height: 300px;
          width: 330px;
          overflow-y: scroll;
          border: solid 1px white;
        }
        table{
          width: 290px;
          height: 300px;
          float: left;
        }
        table, td{
            border: solid 1px #DDD;
            border-collapse: collapse;
            padding: 2px 3px;
            text-align: left;
            font:14px Verdana;
        }
      </style>
  </head>
  <body>
  	<div id="main" style="width: 330px;">
    <div style="text-align: center;">
      <h1>DANH SÁCH HỌC SINH</h1>
    </div>
	  <div style="width: 340px;height: 320px;margin-top: 10px;">
        <div id="danhsach" style="float: left;">
        </div>
	  </div>
	  <div style="width: 330px;text-align: center;">
	  	<input onclick="window.location.href='/fingerlist'" type="button" value="Thoát">
	  </div>
	</div>
	<script type="text/javascript">
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
		window.onload = function(){
      if(sessionStorage.getItem("LOGIN_STATE") != "1"){
        window.location.assign('/login');
      }else{
	      getUserList();
      }
	  }
		var xhttp = new XMLHttpRequest();
		function getUserList(){
	      xhttp.onreadystatechange = function(){
	        if(xhttp.readyState==4 && xhttp.status==200){
	          obj = JSON.parse(xhttp.responseText);
	          window.data=obj;
	          window.num=1;
	          var table = "<table id='tableId'>";
	          table += `<tr><td>STT</td><td>MÃ SỐ</td><td>HỌ TÊN</td></tr>`;
	          for (let key in obj) {
	            table += `<tr><td>${num}</td><td>${esc(key)}</td><td>${esc(obj[key])}</td></tr>`;
	            num++;
	          }
	          table += "</table>";
	          document.getElementById("danhsach").innerHTML = table;
	        }
	      }
	      xhttp.open("GET","/getUserList",true);
	      xhttp.send();
	    }
	</script>
  </body>
</html>
)html";
