// Dev server sem banco de dados — apenas para testar responsividade visual
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
// Assets do portal também na raiz — o portal é servido em "/" e referencia ./css, ./js, ./img
app.use(express.static(path.join(__dirname, '../public/hotspot')));

// Mock API responses
app.get('/api/hotspot/settings', (_, res) => res.json({
  hotspot_title: 'Wi-Fi Inforcenter',
  hotspot_subtitle: 'Conecte-se e aproveite a internet mais rápida da região!',
  hotspot_free_time: '60', client_free_time: '480', otp_expiry_minutes: '5',
  require_name: '1', require_email: '0'
}));
app.post('/api/hotspot/cpf-login', (_, res) => res.json({ success: true, name: 'Cliente Teste', freeTimeMinutes: 480, username: 'cliente_11240010699', password: 'abc12345' }));
app.post('/api/hotspot/send-otp', (_, res) => res.json({ success: true, debug_code: '123456' }));
app.post('/api/hotspot/verify', (_, res) => res.json({ success: true, freeTimeMinutes: 60, username: 'lead_38988090001', password: 'abc12345' }));
app.post('/api/auth/login', (_, res) => res.json({ token: 'dev-token', username: 'admin' }));
app.get('/api/admin/dashboard', (_, res) => res.json({
  totalLeads: 247, todayLeads: 12, thisMonthLeads: 89, totalSessions: 198, totalClients: 63,
  dailyLeads: [
    {date: '2026-07-30', count: 8},{date: '2026-07-31', count: 15},{date: '2026-08-01', count: 11},
    {date: '2026-08-02', count: 20},{date: '2026-08-03', count: 7},{date: '2026-08-04', count: 18},{date: '2026-08-05', count: 12}
  ]
}));
app.get('/api/admin/leads', (_, res) => res.json({ total: 247, page: 1, limit: 50, leads: [
  {id:1,name:'João Silva',phone:'38988090001',email:'joao@email.com',cpf:'',is_client:0,mac_address:'AA:BB:CC:DD:EE:01',ip_address:'192.168.10.21',created_at:'2026-08-05T10:30:00'},
  {id:2,name:'Maria Oliveira (cliente)',phone:'',email:'',cpf:'112.400.106-99',is_client:1,mac_address:'AA:BB:CC:DD:EE:02',ip_address:'192.168.10.22',created_at:'2026-08-05T10:45:00'},
  {id:3,name:'Pedro Santos',phone:'38988090003',email:'pedro@email.com',cpf:'',is_client:0,mac_address:'AA:BB:CC:DD:EE:03',ip_address:'192.168.10.23',created_at:'2026-08-05T11:00:00'},
]}));
app.get('/api/admin/sessions', (_, res) => res.json({
  activeSessions: [{user:'cliente_11240010699','mac-address':'AA:BB:CC:DD:EE:01',address:'192.168.10.21',uptime:'00:23:14'}],
  sessions: [{name:'Maria Oliveira',phone:'',mac_address:'AA:BB:CC:DD:EE:01',ip_address:'192.168.10.21',started_at:'2026-08-05T10:30:00'}]
}));
app.get('/api/admin/settings', (_, res) => res.json({
  hotspot_title:'Wi-Fi Inforcenter',hotspot_subtitle:'Conecte-se agora!',
  hotspot_free_time:'60',client_free_time:'480',otp_expiry_minutes:'5',require_name:'1',require_email:'0',
  mikrotik_host:'192.168.88.1',mikrotik_port:'8728',mikrotik_user:'admin',mikrotik_hotspot_server:'hotspot1'
}));
app.put('/api/admin/settings', (_, res) => res.json({ success: true }));
app.post('/api/admin/mikrotik/test', (_, res) => res.json({ success: true, identity: 'INFORCENTER-RB' }));
app.post('/api/auth/change-password', (_, res) => res.json({ success: true }));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, '../public/admin/index.html')));
app.get('/admin/*', (_, res) => res.sendFile(path.join(__dirname, '../public/admin/index.html')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, '../public/hotspot/index.html')));

app.listen(3000, () => console.log('Dev server rodando em http://localhost:3000'));
