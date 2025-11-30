// ================== Firebase config ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUnfJ3AUjlAhdj_mJ_iqO3udIxBPrp068",
  authDomain: "qr-code-device.firebaseapp.com",
  databaseURL: "https://qr-code-device-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "qr-code-device",
  storageBucket: "qr-code-device.firebasestorage.app",
  messagingSenderId: "772242743351",
  appId: "1:772242743351:web:678b6cc63f402a02499fb2",
  measurementId: "G-1JC4MYPX0J"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ================== COMMON ==================
window.logout = function(){
  sessionStorage.clear();
  window.location.href = "index.html";
};

// ================== INDEX PAGE ==================
if(document.getElementById("adminBtn")){
  document.getElementById("adminBtn").onclick = () => {
    const email = document.getElementById("adminEmail").value.trim();
    const pass = document.getElementById("adminPass").value.trim();
    if(email === "thinhit@gmail.com" && pass === "12345678"){
      sessionStorage.setItem("role","admin");
      window.location.href = "admin.html";
    } else {
      alert("Sai tài khoản admin!");
    }
  };

  document.getElementById("studentBtn").onclick = () => {
    const mssv = document.getElementById("mssv").value.trim();
    if(!mssv){ alert("Vui lòng nhập MSSV!"); return; }
    if(!/^\d{8}$/.test(mssv)){ alert("MSSV không hợp lệ!"); return; }
    sessionStorage.setItem("role","student");
    sessionStorage.setItem("mssv",mssv);
    window.location.href = "student.html";
  };
}

// ================== STUDENT PAGE ==================
if(document.getElementById("qr-reader")){
  if(sessionStorage.getItem("role")!=="student"){
    window.location.href="index.html";
  }
  const mssv = sessionStorage.getItem("mssv");
  document.getElementById("info").innerHTML = "MSSV: " + mssv;

  let scanner;

  // Tạo nút "Hành động mới"
  const actionBtn = document.createElement("button");
  actionBtn.id = "action-btn";
  actionBtn.innerText = "Hành động mới";
  actionBtn.style.display = "none";
  document.getElementById("result").after(actionBtn);

  actionBtn.addEventListener("click", () => {
    document.getElementById("result").innerHTML = "";
    actionBtn.style.display = "none";
    scanner.render(onScanSuccess); // quay về giao diện chọn camera/ảnh
  });

  // Hàm xử lý khi quét thành công
  function onScanSuccess(qr) {
  document.getElementById("result").innerHTML = "✅ Đã quét: " + qr;

  handleQR(qr)
    .then(() => {
      actionBtn.style.display = "block";
      scanner.clear();
    })
    .catch((err) => {
      const msg = "❌ Lỗi xử lý QR: " + err.message;
      document.getElementById("result").innerHTML = msg;
      alert(msg);
      sendToLCD("QR Error");
      actionBtn.style.display = "block";
      scanner.clear();
    });
  }

  // Khởi tạo scanner ban đầu
  scanner = new Html5QrcodeScanner("qr-reader", {
    fps: 10,
    qrbox: 475,
    aspectRatio: 1.0
  });
  scanner.render(onScanSuccess);

  //new Html5QrcodeScanner("qr-reader",{fps:10,qrbox:400, aspectRatio: 1.0}).render(onScanSuccess);

  async function handleQR(deviceID){
    const deviceRef = ref(db,"devices/"+deviceID);
    const snap = await get(deviceRef);
  if(!snap.exists()){ 
      const msg = "Thiết bị không tồn tại hoặc mã không đúng!";
      document.getElementById("result").innerHTML = msg;
      sendToLCD("No Device Found");
      return; 
    }
    const device = snap.val();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:-]/g,'').split('.')[0]+"Z";
    const logKey = `${timestamp}_${mssv}_${deviceID}`;

    const logsSnap = await get(ref(db,"logs"));
    let foundLog=null;
    logsSnap.forEach(item=>{
      const log=item.val();
      if(log.device_id===deviceID && log.student_id===mssv && log.status==="borrowed"){
        foundLog=item.key;
      }
    });

    if(foundLog){
      await update(deviceRef,{available_quantity:device.available_quantity+1,borrowed_quantity:device.borrowed_quantity-1});
      await update(ref(db,"logs/"+foundLog),{status:"returned",return_time:now.toLocaleString()});
      const msg = "✔ Trả thành công " + deviceID;
      document.getElementById("result").innerHTML = msg;
      alert(msg);
      sendToLCD(mssv + " Returned " + deviceID);
      return;
    }

    if(device.available_quantity>0){
      await update(deviceRef,{available_quantity:device.available_quantity-1,borrowed_quantity:device.borrowed_quantity+1});
      await set(ref(db,"logs/"+logKey),{student_id:mssv,device_id:deviceID,status:"borrowed",borrow_time:now.toLocaleString({timeZone: 'Asia/Ho_Chi_Minh'})
        ,return_time:null});
      const msg = "✔ Mượn thành công " + deviceID;
      document.getElementById("result").innerHTML = msg;
      alert(msg);
      sendToLCD(mssv + " Borrow " + deviceID);
      return;
   }

    const msg = "Thiết bị đã được mượn!";
    document.getElementById("result").innerHTML = msg;
    alert(msg);
    sendToLCD("Already borrow");
  }
  
function renderBorrowingList() {
    const logsRef = ref(db, "logs");

    onValue(logsRef, (snap)=>{
        const tbody = document.querySelector("#borrowTable tbody");
        tbody.innerHTML = "";

        let hasBorrowed = false;

        snap.forEach(item=>{
            const log = item.val();

            // Convert toàn bộ về chuỗi để so sánh chính xác
            const sid = String(log.student_id);
            const stat = String(log.status);

            if(sid === mssv && stat === "borrowed"){
                hasBorrowed = true;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${log.device_id}</td>
                    <td>${log.borrow_time}</td>
                `;
                tbody.appendChild(tr);
            }
        });

        if(!hasBorrowed){
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>--</td>
                <td>--</td>
            `;
            tbody.appendChild(tr);
        }
    });
}

  // Gọi hàm thống kê log 
  renderBorrowingList();

  // Gửi data đến ESP in ra LCD
  function sendToLCD(message) {
    const espIP = "http://192.168.137.93"; // Đổi thành IP thật của ESP8266 192.168.137.172
    fetch(espIP + "/lcd?msg=" + encodeURIComponent(message))
      .then(res => console.log("LCD updated:", res.status))
      .catch(err => console.error("LCD error:", err));
  }

}

// ================== ADMIN PAGE ==================
if(document.getElementById("deviceTable")){
  if(sessionStorage.getItem("role")!=="admin"){
    window.location.href="index.html";
  }

  // render devices
  const deviceRef=ref(db,"devices");
  onValue(deviceRef,(snap)=>{
    const tbody=document.querySelector("#deviceTable tbody");
    tbody.innerHTML="";
    snap.forEach(item=>{
      const d=item.val();
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${item.key}</td>
        <td>${d.name}</td>
        <td>${d.total_quantity}</td>
        <td>${d.available_quantity}</td>
        <td>${d.borrowed_quantity}</td>
      `;
      tbody.appendChild(tr);
    });
  });

// render logs
const logsRef = ref(db, "logs");
onValue(logsRef, (snap) => {
  const tbody = document.querySelector("#logsTable tbody");
  const pagination = document.getElementById("pagination");
  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const logEntries = [];
  snap.forEach(item => {
    const log = item.val();
    logEntries.push({ key: item.key, ...log });
  });

  // Sắp xếp mới nhất trước
  logEntries.sort((a, b) => {
    const dateA = new Date(a.return_time || a.borrow_time);
    const dateB = new Date(b.return_time || b.borrow_time);
    return dateB - dateA;
  });

  const pageSize = 20;
  let currentPage = 1;
  const totalPages = Math.ceil(logEntries.length / pageSize);

  function renderPage(page) {
    tbody.innerHTML = "";
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageData = logEntries.slice(start, end);

    pageData.forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.key}</td>
        <td>${log.student_id}</td>
        <td>${log.device_id}</td>
        <td>${log.status}</td>
        <td>${log.borrow_time}</td>
        <td>${log.return_time || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPagination() {
    pagination.innerHTML = "";

    // Nút "<"
    const prevBtn = document.createElement("button");
    prevBtn.innerText = "<";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
      currentPage--;
      renderPage(currentPage);
      renderPagination();
    });
    pagination.appendChild(prevBtn);

    // Các số trang
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.innerText = i;
      btn.disabled = (i === currentPage);
      btn.addEventListener("click", () => {
        currentPage = i;
        renderPage(currentPage);
        renderPagination();
      });
      pagination.appendChild(btn);
    }

    // Nút ">"
    const nextBtn = document.createElement("button");
    nextBtn.innerText = ">";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
      currentPage++;
      renderPage(currentPage);
      renderPagination();
    });
    pagination.appendChild(nextBtn);
  }

  // Khởi tạo
  renderPage(currentPage);
  renderPagination();
});


  // add device
  document.getElementById("addBtn").onclick = async ()=>{
    const id=document.getElementById("addDeviceID").value.trim();
    const name=document.getElementById("addDeviceName").value.trim();
    const total=parseInt(document.getElementById("addDeviceTotal").value.trim());
    if(!id||!name||isNaN(total)||total<=0){ alert("Thông tin không hợp lệ!"); return; }
    const deviceRef=ref(db,"devices/"+id);
    const snap=await get(deviceRef);
    if(snap.exists()){ alert("Thiết bị đã tồn tại!"); return; }
    await set(deviceRef,{name,total_quantity:total,available_quantity:total,borrowed_quantity:0});
    alert("Thêm thiết bị thành công!");
    document.getElementById("addDeviceID").value="";
    document.getElementById("addDeviceName").value="";
    document.getElementById("addDeviceTotal").value="";
  };

  // delete device
  document.getElementById("deleteBtn").onclick = async ()=>{
    const id=document.getElementById("deleteDeviceID").value.trim();
    if(!id){ alert("Nhập Device ID cần xóa!"); return; }
    const deviceRef=ref(db,"devices/"+id);
    const snap=await get(deviceRef);
    if(!snap.exists()){ alert("Thiết bị không tồn tại!"); return; }
    await remove(deviceRef);
    alert("Xóa thiết bị thành công!");
    document.getElementById("deleteDeviceID").value="";
  };
}