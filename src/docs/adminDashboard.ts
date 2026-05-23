export const adminHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>SaaS Portal - SecureVault PQ</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: auto; }
        h1 { color: #333; }
        .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .btn { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        .btn-danger { background: #dc3545; }
        .btn:hover { opacity: 0.9; }
        .form-group { margin-bottom: 15px; }
        .form-control { width: 100%; padding: 8px; box-sizing: border-box; text-align: center; font-size: 16px; letter-spacing: 2px; }
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .auth-box { background: #fff; padding: 40px; border-radius: 8px; text-align: center; width: 350px; }
        .hidden { display: none !important; }
        #qrImage { border: 2px solid #ccc; padding: 5px; border-radius: 8px; margin: 10px 0; width: 200px; }
        header { display: flex; justify-content: space-between; align-items: center; }
        .inactivity-bar { height: 4px; background: #28a745; width: 100%; position: fixed; top: 0; left: 0; transition: width 1s linear; }
    </style>
</head>
<body>
    <div class="inactivity-bar" id="inactivityBar"></div>

    <!-- Login View -->
    <div id="loginOverlay" class="overlay">
        <div class="auth-box">
            <h2>Autenticação Universal</h2>
            <p style="font-size:12px; color:#666">Insira a ADMIN_API_KEY ou a sua TENANT_API_KEY</p>
            <input type="password" id="apiKeyInput" class="form-control" placeholder="Chave de Acesso">
            <br><br>
            <button class="btn" style="width:100%" onclick="doLogin()">Entrar Seguramente</button>
            <p id="authError" style="color:red; font-size: 12px; margin-top:10px;"></p>
        </div>
    </div>

    <!-- Setup TOTP View -->
    <div id="setupOverlay" class="overlay hidden">
        <div class="auth-box">
            <h2>Configuração de 2FA</h2>
            <p style="font-size:12px; color:#666">Primeiro acesso detectado. Escaneie o código com seu Google Authenticator.</p>
            <img id="qrImage" src="" />
            <br>
            <input type="text" id="setupCodeInput" class="form-control" placeholder="000000" maxlength="6">
            <br><br>
            <button class="btn" style="width:100%" onclick="verifyTotp()">Validar e Conectar</button>
            <p id="setupError" style="color:red; font-size: 12px; margin-top:10px;"></p>
        </div>
    </div>

    <!-- Enter TOTP View -->
    <div id="totpOverlay" class="overlay hidden">
        <div class="auth-box">
            <h2>Autenticação em Duas Etapas</h2>
            <p style="font-size:12px; color:#666">Abra seu app e digite o código de 6 dígitos.</p>
            <input type="text" id="totpCodeInput" class="form-control" placeholder="000000" maxlength="6">
            <br><br>
            <button class="btn" style="width:100%" onclick="verifyTotp()">Verificar Código</button>
            <p id="totpError" style="color:red; font-size: 12px; margin-top:10px;"></p>
        </div>
    </div>

    <!-- Painel Dashboard -->
    <div class="container hidden" id="dashboardView">
        <header>
            <h1>Portal SecureVault (<span id="userRoleBadge"></span>)</h1>
            <button class="btn btn-danger" onclick="logout()">Sair com Segurança</button>
        </header>
        
        <div class="card" id="adminTools" style="display:none;">
            <h2>Criar Novo Cliente (Tenant)</h2>
            <div class="form-group"><input type="text" id="tName" class="form-control" placeholder="Nome da Empresa"></div>
            <div class="form-group"><input type="email" id="tEmail" class="form-control" placeholder="Email de Contato"></div>
            <button class="btn" onclick="createTenant()">Gerar Credenciais</button>
            <p id="newCreds" style="color: green; font-weight: bold;"></p>
            <hr>
            <h2>Clientes Cadastrados (<span id="totalTenants">0</span>)</h2>
            <table>
                <thead><tr><th>ID</th><th>Nome Empresa</th><th>Criado Em</th></tr></thead>
                <tbody id="tenantsBody"></tbody>
            </table>
        </div>

        <div class="card">
            <h2>Logs Recentes de API <span style="font-size: 12px; color: #888;">(Auto-atualizado)</span></h2>
            <table>
                <thead><tr><th>Cliente</th><th>Método</th><th>Rota</th><th>Status</th><th>Tempo</th><th>Data</th></tr></thead>
                <tbody id="logsBody"></tbody>
            </table>
        </div>
    </div>

    <script>
        let tempToken = "";
        let sessionToken = "";
        let lastActivity = Date.now();
        let pingInterval;

        // Gerenciamento de Inatividade (Auto-Logout em 5 Minutos)
        const MAX_INACTIVITY = 5 * 60 * 1000;
        
        document.addEventListener('mousemove', resetActivity);
        document.addEventListener('keydown', resetActivity);
        document.addEventListener('click', resetActivity);

        function resetActivity() {
            if (sessionToken) lastActivity = Date.now();
        }

        setInterval(() => {
            if (sessionToken) {
                let idleTime = Date.now() - lastActivity;
                let percentage = Math.max(0, 100 - (idleTime / MAX_INACTIVITY) * 100);
                document.getElementById('inactivityBar').style.width = percentage + "%";
                if (percentage < 25) document.getElementById('inactivityBar').style.background = "#dc3545";
                else document.getElementById('inactivityBar').style.background = "#28a745";

                if (idleTime > MAX_INACTIVITY) {
                    alert("Sessão encerrada por inatividade.");
                    logout();
                }
            }
        }, 1000);

        async function doLogin() {
            const key = document.getElementById('apiKeyInput').value;
            try {
                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro no login");
                
                tempToken = data.temp_token;
                document.getElementById('loginOverlay').classList.add('hidden');

                if (data.require_setup) {
                    document.getElementById('qrImage').src = data.qrcode;
                    document.getElementById('setupOverlay').classList.remove('hidden');
                } else {
                    document.getElementById('totpOverlay').classList.remove('hidden');
                }
            } catch(e) {
                document.getElementById('authError').innerText = e.message;
            }
        }

        async function verifyTotp() {
            const codeInput = document.getElementById('setupOverlay').classList.contains('hidden') 
                                ? document.getElementById('totpCodeInput') 
                                : document.getElementById('setupCodeInput');
            const code = codeInput.value;
            try {
                const res = await fetch('/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ temp_token: tempToken, code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                sessionToken = data.session_token;
                document.getElementById('setupOverlay').classList.add('hidden');
                document.getElementById('totpOverlay').classList.add('hidden');
                document.getElementById('dashboardView').classList.remove('hidden');
                document.getElementById('userRoleBadge').innerText = data.role.toUpperCase();

                if (data.role === 'admin') document.getElementById('adminTools').style.display = 'block';

                loadData();
                startBackgroundRefresh();
            } catch(e) {
                document.getElementById('setupError').innerText = e.message;
                document.getElementById('totpError').innerText = e.message;
            }
        }

        function startBackgroundRefresh() {
            pingInterval = setInterval(async () => {
                let idleTime = Date.now() - lastActivity;
                // Só atualiza o token se o usuário estiver ativo nos últimos 4 minutos
                if (idleTime < 4 * 60 * 1000) {
                    const res = await fetch('/auth/refresh', { headers: { 'Authorization': 'Bearer ' + sessionToken } });
                    if (res.ok) {
                        const data = await res.json();
                        sessionToken = data.session_token;
                        loadData(); // Auto reload dados
                    } else {
                        logout();
                    }
                }
            }, 60000); // Tenta renovar a cada 1 minuto caso ativo
        }

        function logout() {
            sessionToken = ""; tempToken = "";
            clearInterval(pingInterval);
            window.location.reload();
        }

        async function api(path, method = 'GET', body = null) {
            const res = await fetch('/portal' + path, {
                method,
                headers: { 'Authorization': 'Bearer ' + sessionToken, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro de servidor");
            return data;
        }

        async function loadData() {
            try {
                const data = await api('/metrics');
                if (data.role === 'admin') {
                    document.getElementById('totalTenants').innerText = data.total_tenants;
                    document.getElementById('tenantsBody').innerHTML = data.tenants.map(t => 
                        \`<tr><td>\${t.id.split('-')[0]}...</td><td>\${t.name}</td><td>\${new Date(t.created_at).toLocaleString()}</td></tr>\`
                    ).join('');
                }

                document.getElementById('logsBody').innerHTML = data.recent_logs.map(l => 
                    \`<tr>
                        <td>\${l.tenant_name}</td>
                        <td><span class="badge" style="background: \${l.method==='POST'?'#007bff':'#6c757d'}">\${l.method}</span></td>
                        <td>\${l.endpoint}</td>
                        <td>\${l.status_code}</td>
                        <td>\${l.response_time_ms} ms</td>
                        <td>\${new Date(l.created_at).toLocaleString()}</td>
                    </tr>\`
                ).join('');
            } catch (e) { console.error(e); }
        }

        async function createTenant() {
            try {
                const name = document.getElementById('tName').value;
                const email = document.getElementById('tEmail').value;
                const res = await api('/tenants', 'POST', { name, email });
                document.getElementById('newCreds').innerText = \`SUCESSO! API Key: \${res.apiKey}\`;
                loadData();
            } catch(e) { alert("Erro: " + e.message); }
        }
    </script>
</body>
</html>
`