const char fingerPage[] PROGMEM = R"html(
<!DOCTYPE html>
  <html>
  <head>
      <meta name="viewport" content="width=device-width,user-scalable=0"  charset="utf-8">
      <title>Vân tay</title>
      <style type="text/css">
      	#main{
      		margin: 10px auto;
      	}
      	h1{
      		color: red;
          font-size: 26px;
      	}
      	input[type="text"]{
      		width: 230px;
      		height: 30px;
      		float: left;
      		font-size: 18px;
      	}
      	label{
      		font-weight: bold;
      	}
      	.col1{
      		width: 100px;
      		float: left;
      	}
      	.col2{
      		width: 200px;
      		float: left;
      	}
      	.row{
      		width: 400px;
      		float: left;
      		margin-bottom: 20px;
      	}
      	input[type="button"]{
      		width: 100px;
      		height: 40px;
      		margin-right: 15px;
      	}
        #danhsach{
          height: 300px;
          width: 330px;
          overflow-y: scroll;
          border: solid 1px white;
        }
        table{
          width: 290px;
          height: 50px;
          float: left;
        }
        table, td{
            border: solid 1px #DDD;
            border-collapse: collapse;
            padding: 2px 3px;
            text-align: left;
            font:14px Verdana;
        }
        #hoten{
      		background: lightgray;
      	}
      </style>
  </head>
  <body>
  	<div id="main" style="width: 330px;">
    <div style="text-align: center;">
      <h1>THIẾT LẬP VÂN TAY</h1>
    </div>
	  <div class="row">
		  <div class="col1">
		  	<label>Mã học sinh:</label>
		  </div>
		  <div class="col2">
		  	<input id="mahs" onblur="checkUser()" type="text">
		  </div>
	  </div>
	  <div class="row">
		  <div class="col1">
		  	<label>Họ và tên:</label>
		  </div>
		  <div class="col2">
		  	<input id="hoten" type="text" readonly="true">
		  </div>
	  </div>
	  <div class="row" style="border: 1px black solid;width: 340px;height: 30px;background: yellow;color: red;text-align: center;padding-top: 10px;">
		<b><span id="info">Vui lòng điền mã học sinh!</span></b>	  
	  </div>
	  <div style="width: 400px;">
	  	<input onclick="addFinger()" type="button" value="Thêm">
	  	<input onclick="deleteFinger()" type="button" value="Xóa">
	  	<input onclick="exit()" type="button" value="Thoát">
	  </div>
    <div class="row" style="width: 340px;height: 350px;margin-top: 20px;">
		<h3 style="margin-top: 10px;margin-left: 15px;color: blue;">Danh sách đã thêm</h3>
        <div id="danhsach" style="float: left;">
        </div>
	  </div>
	  <div style="text-align: center;">
	  	<a href="/userlist">Danh sách học sinh</a>
	  </div>
	</div>
	<script type="text/javascript">
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
		window.onload=function(){
      if(sessionStorage.getItem("LOGIN_STATE") != "1"){
        window.location.assign('/login');
      }else{
        init();
        getFingerList();
        checkUser();
      }
    }
    document.addEventListener('DOMContentLoaded', (event) => {
        const input1 = document.getElementById('mahs');
        const input2 = document.getElementById('hoten');
        input1.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
              event.preventDefault(); // Ngăn chặn hành động mặc định của Enter
              input2.focus(); // Chuyển focus sang ô input thứ hai
            }
        });
    });

    var Socket;
    function init(){
      Socket=new WebSocket('ws://' + window.location.hostname + ':81');
      Socket.onmessage = function(event){
          document.getElementById("info").textContent=event.data;
          if(event.data=="Đã lưu vân tay thành công!" || event.data=="Danh sách vân tay đã thay đổi"){
            getFingerList();
          }
      }
    }
		var xhttp = new XMLHttpRequest();
		function checkUser(){
			var request = new XMLHttpRequest();
			mahs = document.getElementById("mahs").value;
			request.onreadystatechange = function(){
		        if(request.readyState==4&&request.status==200){
		        	document.getElementById("hoten").value=request.responseText;
		        }
		    }

			request.open("GET","/checkUser?mahs=" + encodeURIComponent(mahs),true);
			request.send();
		}
    function getFingerList(){
	      var request = new XMLHttpRequest();
	      request.onreadystatechange = function(){
	        if(request.readyState==4 && request.status==200){
	          obj = JSON.parse(request.responseText);
          window.data=obj;
          window.num=1;
          var table = "<table id='tableId'>";
          table += `<tr><td>STT</td><td>MÃ SỐ</td><td>HỌ TÊN</td><td>SVT</td></tr>`;
          for (let key in obj) {
            table += `<tr><td>${num}</td><td>${esc(key)}</td><td>${esc(obj[key][0])}</td><td>${esc(obj[key][1])}</td></tr>`;
            num++;
          }
          table += "</table>";
          document.getElementById("danhsach").innerHTML = table;
          var rows = document.getElementById("tableId").rows;
          for (i = 0; i < rows.length; i++) {
            rows[i].onclick = function(){ 
              return function(){
                  var mahs= this.cells[1].textContent;
                  var hoten= this.cells[2].textContent;
                  document.getElementById("mahs").value=mahs;
                  document.getElementById("hoten").value=hoten;
                };
            }(rows[i]);
          }
        }
      }
	      request.open("GET","/getFingerList",true);
	      request.send();
    }
		function addFinger(){
			mahs = document.getElementById("mahs").value;
			xhttp.onreadystatechange = function(){
		        if(xhttp.readyState==4&&xhttp.status==200){
		        	document.getElementById("info").textContent=xhttp.responseText;
		        }
		    }

			xhttp.open("POST","/addFinger",true);
            xhttp.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
          	xhttp.send('mahs='+encodeURIComponent(mahs));
		}
		function deleteFinger(){
			mahs = document.getElementById("mahs").value;
			xhttp.onreadystatechange = function(){
		        if(xhttp.readyState==4&&xhttp.status==200){
		          document.getElementById("info").textContent=xhttp.responseText;
              getFingerList();
		        }
		    }

			xhttp.open("POST","/deleteFinger",true);
            xhttp.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
          	xhttp.send('mahs='+encodeURIComponent(mahs));
		}
    function exit(){
      window.location.assign('/');
    }
	</script>
  </body>
</html>
)html";
