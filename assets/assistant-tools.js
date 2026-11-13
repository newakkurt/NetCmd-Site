/* NetCmd Assistant Tools: deterministic local network workflows. No device commands are executed. */
(function () {
  'use strict';
  var cfg = document.getElementById('as-cfg');
  var input = document.getElementById('as-in');
  var out = document.getElementById('as-out');
  if (!cfg || !input || !out) return;
  var lang = (document.documentElement.lang || 'tr').slice(0, 2);
  var tr = lang !== 'en' && lang !== 'ar';
  var labels = tr ? {
    title:'Network Engineer Araçları', intro:'AI ile sor butonu korunur. Aşağıdaki araçlar yerel ve anında çalışır.',
    task:'Araç', vendor:'Üretici', model:'Model / işletim sistemi', run:'Çalıştır', copy:'Çıktıyı kopyala',
    config:'Konfigürasyon üret', audit:'Config analiz', compare:'Config karşılaştır', diagnose:'Arıza teşhis', logs:'Log / çıktı analiz', translate:'Komut çevir', security:'Güvenlik denetimi', automation:'Otomasyon üret', learn:'Eğitim modu',
    placeholder:'İsteğini veya cihaz çıktısını buraya yaz. Örn: VLAN 20 oluştur ve GE0/0/1 portunu access yap.',
    note:'Bu araçlar cihazına bağlanmaz ve komut çalıştırmaz. Üretilen değişiklikleri uygulamadan önce model/sürüm, mevcut yapılandırma ve bakım penceresini doğrula.',
    empty:'Lütfen bir istek veya yapılandırma/çıktı gir.', noMatch:'Kesin bir eşleşme bulunamadı. Üretici dokümanını ve cihaz sürümünü doğrula.',
    risk:'Risk / Ön kontrol', next:'Önerilen sonraki adım', safe:'Salt okunur kontrol', high:'Değişiklik öncesi yedek ve onay gerekli',
    vlan:'VLAN', port:'Port', id:'VLAN ID', name:'VLAN adı', iface:'Arayüz', desc:'Açıklama', ip:'IP / Prefix', area:'OSPF Area',
    generated:'Üretilen komutlar', findings:'Bulgular', noFindings:'Belirgin bir bulgu yakalanmadı; bu tam güvenlik denetimi değildir.',
    commands:'Komutlar', explanation:'Açıklama', rollback:'Geri dönüş: değişiklik öncesi yedekten eski konfigürasyonu geri yükle; uzaktan erişimi etkileyen işlemleri konsol/OOB erişimi olmadan yapma.',
    training:'Bu ne? Komutun yaptığı işlemi açıklar. Neden lazım? Ağ tasarımındaki amacını belirtir. Paket burada ne yapıyor? Trafiğin ilgili VLAN/arayüz/protokol üzerindeki etkisini açıklar.',
    converted:'Bilinen karşılıklar', limited:'Bu çeviri yalnızca bilinen temel komut kalıplarını kapsar; birebir sözdizimi ve özellik eşitliği garanti edilmez.',
    saved:'Bu çıktı yalnızca tarayıcıda üretildi; cihaza gönderilmedi.'
  } : {
    title:'Network Engineer Tools', intro:'The “Ask AI” button remains. These deterministic tools run locally.',
    task:'Tool', vendor:'Vendor', model:'Model / OS', run:'Run', copy:'Copy output',
    config:'Generate config', audit:'Config audit', compare:'Config diff', diagnose:'Troubleshoot', logs:'Log / output analysis', translate:'Command translator', security:'Security audit', automation:'Automation generator', learn:'Learning mode',
    placeholder:'Describe the task or paste device output. Example: create VLAN 20 and make GE0/0/1 an access port.',
    note:'These tools do not connect to or execute commands on devices. Verify model/version, current configuration and maintenance window before applying changes.',
    empty:'Enter a task or configuration/output.', noMatch:'No confident match. Verify the vendor documentation and device version.',
    risk:'Risk / pre-check', next:'Recommended next step', safe:'Read-only check', high:'Backup and approval required',
    vlan:'VLAN', port:'Port', id:'VLAN ID', name:'VLAN name', iface:'Interface', desc:'Description', ip:'IP / Prefix', area:'OSPF Area',
    generated:'Generated commands', findings:'Findings', noFindings:'No obvious finding detected; this is not a complete security audit.',
    commands:'Commands', explanation:'Explanation', rollback:'Rollback: restore the pre-change backup; do not change remote access without console/OOB access.',
    training:'What is it? Explains what the command does. Why is it needed? Describes its network-design purpose. What happens to the packet? Explains the traffic impact on the VLAN/interface/protocol.',
    converted:'Known equivalents', limited:'Translation covers known basic patterns only; exact syntax and feature parity are not guaranteed.',
    saved:'Generated locally in this browser; nothing was sent to a device.'
  };
  var vendors = ['cisco','huawei','aruba','juniper','mikrotik'];
  var names = {cisco:'Cisco IOS/IOS-XE',huawei:'Huawei VRP',aruba:'Aruba AOS-CX',juniper:'Juniper Junos',mikrotik:'MikroTik RouterOS'};
  var tabs = [
    ['config',labels.config],['audit',labels.audit],['compare',labels.compare],['diagnose',labels.diagnose],['logs',labels.logs],
    ['translate',labels.translate],['security',labels.security],['automation',labels.automation],['learn',labels.learn]
  ];
  function node(tag, cls, value) { var n=document.createElement(tag); if(cls)n.className=cls; if(value!==undefined)n.textContent=value; return n; }
  var style=node('style'); style.textContent='.as-tools{margin:24px 0}.as-tool-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.as-tool-tabs button{border:1px solid var(--line,#444);border-radius:9px;padding:9px 12px;background:var(--surface-2,transparent);color:inherit;cursor:pointer}.as-tool-tabs button[aria-pressed=true]{border-color:var(--accent,#4b8);background:var(--surface-3,rgba(80,150,120,.12))}.as-tool-panel{border:1px solid var(--line,#444);border-radius:14px;padding:16px;margin-top:10px}.as-tool-panel textarea,.as-tool-panel select,.as-tool-panel input{box-sizing:border-box;width:100%;margin:6px 0 12px;padding:11px;border:1px solid var(--line,#555);border-radius:8px;background:var(--surface,#111);color:inherit}.as-tool-result{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border-radius:10px;background:var(--surface-2,rgba(127,127,127,.1));margin-top:12px}.as-tool-meta{font-size:.9em;opacity:.8}.as-tool-panel .btn{margin:4px 6px 4px 0}';
  document.head.appendChild(style);
  var root=node('section','as-tools'); root.setAttribute('aria-label',labels.title);
  root.appendChild(node('h2','',labels.title)); root.appendChild(node('p','lead',labels.intro));
  var nav=node('div','as-tool-tabs'); nav.setAttribute('role','tablist');
  var panel=node('div','as-tool-panel'); root.appendChild(nav); root.appendChild(panel);
  var anchor=input.closest('.as-box') || input.parentNode;
  anchor.parentNode.insertBefore(root, anchor.nextSibling);
  var active='config', vendor='cisco', model='', task='';
  function field(label, id, value, type) {
    var wrap=node('label','',label), el=node(type==='textarea'?'textarea':'input');
    el.id=id; if(type!=='textarea') el.type=type||'text'; if(value)el.value=value;
    wrap.appendChild(el); panel.appendChild(wrap); return el;
  }
  function selectField(label,id,opts,selected) {
    var wrap=node('label','',label), s=node('select'); s.id=id;
    opts.forEach(function(o){var op=node('option','',o[1]);op.value=o[0];s.appendChild(op);});
    s.value=selected||opts[0][0];wrap.appendChild(s);panel.appendChild(wrap);return s;
  }
  function button(text, fn, cls) {var b=node('button','btn '+(cls||''),text);b.type='button';b.addEventListener('click',fn);panel.appendChild(b);return b;}
  function result(text, meta) {
    var box=node('div','as-tool-result',text); panel.appendChild(box);
    if(meta)panel.appendChild(node('p','as-tool-meta',meta));
    button(labels.copy,function(){var v=box.textContent;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(function(){},function(){window.prompt(labels.copy,v);});else window.prompt(labels.copy,v);},'sec');
  }
  function clean(s){return String(s||'').trim();}
  function safeInt(v,min,max){var n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:null;}
  function validIPv4(s){var a=String(s).split('.');return a.length===4&&a.every(function(x){return /^\d{1,3}$/.test(x)&&Number(x)<=255;});}
  function validOspfNetwork(s){var a=clean(s).split(/\s+/);return a.length===2&&validIPv4(a[0])&&validIPv4(a[1]);}
  function validOspfArea(s){return (/^\d+$/.test(s)&&Number(s)<=4294967295)||validIPv4(s);}
  function cmd(v,kind,p) {
    var id=p.id, name=p.name, iface=p.iface, desc=p.desc, ip=p.ip, area=p.area;
    if(kind==='vlan') return ({
      cisco:['vlan '+id,' name '+name,'!','interface '+iface,' switchport mode access',' switchport access vlan '+id],
      huawei:['vlan '+id,' description '+name,'quit','interface '+iface,' port link-type access',' port default vlan '+id,'quit'],
      aruba:['vlan '+id,' name '+name,'interface '+iface,' no shutdown',' vlan access '+id],
      juniper:['set vlans '+name+' vlan-id '+id,'set interfaces '+iface+' unit 0 family ethernet-switching interface-mode access','set interfaces '+iface+' unit 0 family ethernet-switching vlan members '+name],
      mikrotik:['/interface bridge vlan add bridge=bridge1 vlan-ids='+id+' tagged=bridge1 untagged='+iface]
    })[v];
    if(kind==='trunk') return ({
      cisco:['interface '+iface,' switchport mode trunk',' switchport trunk allowed vlan add '+id],
      huawei:['interface '+iface,' port link-type trunk',' port trunk allow-pass vlan '+id,'quit'],
      aruba:['interface '+iface,' vlan trunk allowed '+id],
      juniper:['set interfaces '+iface+' unit 0 family ethernet-switching interface-mode trunk','set interfaces '+iface+' unit 0 family ethernet-switching vlan members '+name],
      mikrotik:['/interface bridge vlan add bridge=bridge1 vlan-ids='+id+' tagged='+iface+',bridge1']
    })[v];
    if(kind==='desc') return ({cisco:['interface '+iface,' description '+desc],huawei:['interface '+iface,' description '+desc,'quit'],aruba:['interface '+iface,' description '+desc],juniper:['set interfaces '+iface+' description "'+desc+'"'],mikrotik:['/interface ethernet set [find name="'+iface+'"] comment="'+desc+'"']})[v];
    if(kind==='ospf') return ({
      cisco:['router ospf 1',' network '+ip+' area '+area],
      huawei:['ospf 1 router-id 1.1.1.1',' area '+area,'  network '+ip,'quit','quit'],
      juniper:['set protocols ospf area '+area+' interface '+(iface.indexOf('.')>=0?iface:iface+'.0')],
      aruba:null,
      mikrotik:null
    })[v];
    return null;
  }
  function render() {
    nav.textContent='';
    tabs.forEach(function(t){var b=node('button','',t[1]);b.setAttribute('role','tab');b.setAttribute('aria-pressed',String(active===t[0]));b.addEventListener('click',function(){active=t[0];render();});nav.appendChild(b);});
    panel.textContent='';
    var vsel=selectField(labels.vendor,'ast-vendor',vendors.map(function(v){return[v,names[v]];}),vendor);
    vsel.addEventListener('change',function(){vendor=vsel.value;});
    if(active==='config'||active==='automation'){
      selectField(labels.task,'ast-kind',[['vlan','VLAN access'],['trunk','Trunk VLAN'],['desc','Interface description'],['ospf','OSPF starter']], 'vlan');
      if(active==='automation') selectField('Automation format','ast-format',[['netmiko','Python / Netmiko'],['ansible','Ansible playbook']],'netmiko');
      field(labels.model,'ast-model','Cihaz sürümünü buraya yaz (isteğe bağlı)','text');
      field(labels.id,'ast-id','20','number');field(labels.name,'ast-name','USERS','text');field(labels.iface,'ast-iface','GigabitEthernet0/0/1','text');
      field(labels.desc,'ast-desc','Uplink-to-Core','text');field(labels.ip,'ast-ip','10.20.0.0 0.0.0.255','text');field(labels.area,'ast-area','0','text');
      button(labels.run,function(){
        var kind=document.getElementById('ast-kind').value,id=safeInt(document.getElementById('ast-id').value,1,4094);
        var p={id:id,name:clean(document.getElementById('ast-name').value).replace(/[^\w-]/g,'_'),iface:clean(document.getElementById('ast-iface').value),desc:clean(document.getElementById('ast-desc').value).replace(/[\r\n]/g,' ').slice(0,80),ip:clean(document.getElementById('ast-ip').value),area:clean(document.getElementById('ast-area').value)};
        if(!id||!p.iface||!p.name){result(labels.empty);return;}
        if(!/^[A-Za-z0-9/.:_-]{1,80}$/.test(p.iface)){result(tr?'Arayüz adı geçersiz karakter içeriyor.':'Interface name contains unsupported characters.');return;}
        if(kind==='ospf'&&(!validOspfNetwork(p.ip)||!validOspfArea(p.area))){result(tr?'OSPF için ağ adresini wildcard mask ile (örn. 10.20.0.0 0.0.0.255) ve geçerli area değerini gir.':'For OSPF, enter network plus wildcard mask (e.g. 10.20.0.0 0.0.0.255) and a valid area.');return;}
        var commands=cmd(vendor,kind,p); if(!commands){result(tr?'Bu üretici için güvenilir OSPF şablonu henüz eklenmedi.':'A reliable OSPF template is not available for this vendor yet.');return;}
        if(active==='automation'){
          var fmt=document.getElementById('ast-format').value, pyTypes={cisco:'cisco_ios',huawei:'huawei',aruba:'aruba_aoscx',juniper:'juniper_junos',mikrotik:'mikrotik_routeros'};
          var output;
          if(fmt==='netmiko'){
            output="import os\nfrom getpass import getpass\nfrom netmiko import ConnectHandler\n\n# Verify device model/OS and test in a lab first.\ndevice = {\n    'device_type': '"+pyTypes[vendor]+"',\n    'host': os.getenv('NET_DEVICE_HOST', '192.0.2.10'),\n    'username': os.getenv('NET_DEVICE_USER', 'netadmin'),\n    'password': getpass('Device password: '),\n}\ncommands = "+JSON.stringify(commands)+"\n\nwith ConnectHandler(**device) as conn:\n    print(conn.send_config_set(commands))\n    print('Review the output, then save explicitly if appropriate.')\n";
          } else {
            var osMap={cisco:'cisco.ios.ios',huawei:'community.network.ce',aruba:'arubanetworks.aoscx.aoscx',juniper:'junipernetworks.junos.junos',mikrotik:'community.routeros.routeros'};
            output="---\n- name: NetCmd generated network change\n  hosts: network_devices\n  gather_facts: false\n  connection: ansible.netcommon.network_cli\n  vars:\n    ansible_network_os: "+osMap[vendor]+"\n  tasks:\n    - name: Apply generated commands - review before execution\n      ansible.netcommon.cli_config:\n        config: |\n"+commands.map(function(c){return"          "+c;}).join("\n")+"\n";
          }
          var modelInfo=clean(document.getElementById('ast-model').value);
          result((modelInfo?'# Target model/OS: '+modelInfo+'\n':'')+output,labels.high+' · '+labels.rollback+' · '+labels.saved+' · '+(tr?'Model/sürüm uyumluluğu otomatik doğrulanmaz.':'Model/OS compatibility is not automatically validated.'));
        } else {
          var modelInfo=clean(document.getElementById('ast-model').value);
          result('! '+names[vendor]+' — '+kind+(modelInfo?' — '+modelInfo:'')+'\n'+commands.join('\n')+'\n\n'+labels.rollback,labels.high+' · '+labels.saved+' · '+(tr?'Model alanı yalnızca not amaçlıdır; sürüm uyumluluğu otomatik doğrulanmaz.':'Model field is informational only; version compatibility is not automatically validated.'));
        }
      });
    } else if(active==='compare'){
      var left=field(tr?'Eski konfigürasyon (A)':'Old configuration (A)','ast-left','','textarea');left.rows=10;
      var right=field(tr?'Yeni konfigürasyon (B)':'New configuration (B)','ast-right','','textarea');right.rows=10;
      button(labels.run,function(){
        var a=clean(left.value).split(/\r?\n/),b=clean(right.value).split(/\r?\n/);
        if(!clean(left.value)||!clean(right.value)){result(labels.empty);return;}
        if(a.length>400||b.length>400){result(tr?'Her iki konfigürasyon en fazla 400 satır olabilir.':'Each configuration is limited to 400 lines.');return;}
        var dp=Array.from({length:a.length+1},function(){return new Uint16Array(b.length+1);});
        for(var i=a.length-1;i>=0;i--)for(var j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
        var i=0,j=0,lines=[];
        while(i<a.length||j<b.length){
          if(i<a.length&&j<b.length&&a[i]===b[j]){lines.push('  '+a[i]);i++;j++;}
          else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j])){lines.push('+ '+b[j]);j++;}
          else{lines.push('- '+a[i]);i++;}
        }
        result((tr?'Config farkı (+ eklendi, - silindi)':'Configuration diff (+ added, - removed')+'\n'+lines.join('\n'),tr?'Karşılaştırma tarayıcıda yapıldı; config sunucuya gönderilmedi.':'Diff computed locally in your browser; configs were not uploaded.');
      });
    } else if(active==='audit'||active==='security'||active==='diagnose'||active==='logs'){
      var ta=field(labels.placeholder,'ast-input','', 'textarea');ta.rows=9;
      button(labels.run,function(){
        var text=clean(ta.value);if(!text){result(labels.empty);return;}
        var lines=[],low=text.toLowerCase();
        function add(re,msg){if(re.test(low))lines.push('• '+msg);}
        add(/shutdown|administratively down|down\/down/,'Arayüz kapalı veya link down: fiziksel bağlantı, admin state, speed/duplex ve karşı uç kontrol edilmeli.');
        add(/native vlan|pvid|allowed vlan|port trunk/,'Trunk VLAN uyumsuzluğu/izin listesi kontrol edilmeli; iki uçta native/PVID ve allowed VLAN eşleşmeli.');
        add(/%?ospf.*(neighbor|adjacency)|exstart|init/,'OSPF komşuluğu: area, hello/dead timer, MTU, authentication ve network type kontrol edilmeli.');
        add(/crc|input error|giant|collision/,'Fiziksel katman/optik modül/kablo ve hız-duplex sayaçları incelenmeli.');
        add(/denied|deny|drop|blocked/,'ACL/policy engeli olasılığı: kaynak, hedef, servis, sıra ve hit counter kontrol edilmeli.');
        add(/dhcp.*(fail|timeout)|no.*offer/,'DHCP: VLAN, relay/helper, scope kapasitesi ve snooping binding kontrol edilmeli.');
        add(/loop|bpdu|stp.*(block|inconsistent)/,'STP döngü/koruma durumu: root bridge, port role/state ve BPDU guard olayları kontrol edilmeli.');
        add(/snmp.*(fail|auth)|authentication failure/,'SNMP erişimi: sürüm, kullanıcı, auth/priv, ACL ve hedef trap receiver kontrol edilmeli.');
        add(/memory|cpu|overload|high utilization/,'CPU/bellek yükü: süreçler, trafik artışı ve kontrol düzlemi logları incelenmeli.');
        if(active==='security'||/security|audit|güvenlik/.test(active)){
          add(/telnet/,'Telnet etkin görünüyor: SSH tercih edilmeli ve erişim ACL ile sınırlandırılmalı.');
          add(/snmp-server community|snmp-agent community/,'SNMP community kullanımı tespit edildi: SNMPv3 authPriv değerlendirin.');
          add(/no service password-encryption|password 0|plaintext/,'Düz metin parola ifadesi olabilir: sırları rotasyona alın ve güvenli secret yönetimi kullanın.');
          add(/ip http server|http server enable/,'HTTP yönetimi açık olabilir: HTTPS ile sınırlandırın veya gerekmiyorsa kapatın.');
          add(/ip dhcp snooping|dhcp snooping/,'DHCP Snooping yapılandırmasını VLAN kapsamı ve trusted uplinklerle doğrulayın.');
          add(/aaa|radius|tacacs/,'AAA/RADIUS/TACACS yapılandırması bulundu: yedek yerel erişim ve failover testini doğrulayın.');
          add(/(?:access-list|ip access-list|rule)\b[^\n]*(?:permit\s+ip\s+any\s+any|permit\s+any\s+any|source\s+0\.0\.0\.0\s+0\.0\.0\.0)/,'ACL içinde çok geniş izin kuralı olabilir: kaynak/hedef/servis kapsamını ve kural sırasını daraltın.');
          add(/no spanning-tree|spanning-tree disable|stp disable/,'STP kapatılmış görünüyor: L2 döngü riski için tasarımı ve alternatif loop-prevention mekanizmasını doğrulayın.');
          add(/switchport mode access[\s\S]*switchport trunk|switchport trunk[\s\S]*switchport mode access/,'Aynı konfigürasyonda access ve trunk ifadeleri birlikte bulundu: arayüz bazında port modunu kontrol edin.');
          add(/snmp-server community public|snmp-agent community read public|community public/,'Varsayılan/kolay tahmin edilebilir SNMP community olabilir: kaldırın, SNMPv3 authPriv ve yönetim ACL kullanın.');
          add(/enable password|password 0 |password 7 /,'Enable/parola satırı tespit edildi: parola türünü, hash güvenliğini ve secret rotasyonunu kontrol edin.');
          add(/switchport trunk allowed vlan all|port trunk allow-pass vlan all/,'Trunk üzerinde tüm VLAN’lara izin veriliyor olabilir: yalnızca gerekli VLAN listesini tanımlayın.');
          add(/spanning-tree portfast|portfast/,'Edge portlarda BPDU Guard/Loop Guard politikasını ve uç cihaz istisnalarını doğrulayın.');
          add(/switchport port-security|port-security enable/,'Port security ifadesi bulundu: maksimum MAC, violation aksiyonu ve istisna portlarını doğrulayın.');
          add(/ip access-group|traffic-filter|firewall filter/,'ACL/filter yapılandırması bulundu: doğru arayüze ve doğru yönde bağlandığını, sayaçları kontrol edin.');
        }
        if(!lines.length)lines.push(labels.noFindings);
        result(labels.findings+'\n'+lines.join('\n')+'\n\n'+labels.next+': ilgili show/display komutlarıyla salt okunur doğrulama yap; ardından değişiklik planı ve rollback hazırla.',labels.safe);
      });
    } else if(active==='translate'){
      var q=field(labels.placeholder,'ast-translate','show vlan brief','textarea');q.rows=3;
      button(labels.run,function(){
        var s=clean(q.value).toLowerCase(), map={
          'show vlan brief':{cisco:'show vlan brief',huawei:'display vlan',aruba:'show vlan',juniper:'show vlans',mikrotik:'/interface bridge vlan print'},
          'show interfaces status':{cisco:'show interfaces status',huawei:'display interface brief',aruba:'show interface brief',juniper:'show interfaces terse',mikrotik:'/interface print'},
          'show ip route':{cisco:'show ip route',huawei:'display ip routing-table',aruba:'show ip route',juniper:'show route',mikrotik:'/ip route print'},
          'show lldp neighbors':{cisco:'show lldp neighbors',huawei:'display lldp neighbor brief',aruba:'show lldp neighbors-info',juniper:'show lldp neighbors',mikrotik:'/ip neighbor print'},
          'show mac address-table':{cisco:'show mac address-table',huawei:'display mac-address',aruba:'show mac-address-table',juniper:'show ethernet-switching table',mikrotik:'/interface bridge host print'}
        };
        var key=Object.keys(map).find(function(k){return s===k;});
        if(!key){result(labels.noMatch+'\n'+labels.limited);return;}
        result(labels.converted+' — '+key+'\n'+vendors.map(function(v){return names[v]+': '+map[key][v];}).join('\n'),labels.limited);
      });
    } else if(active==='learn'){
      var q=field(labels.placeholder,'ast-learn','display vlan','textarea');q.rows=3;
      button(labels.run,function(){var s=clean(q.value);if(!s){result(labels.empty);return;}result(s+'\n\n'+labels.training+'\n\n'+labels.next+': cihaz üzerinde önce salt okunur show/display komutuyla mevcut durumu incele ve çıktıyı AI ile sor bölümüne ekle.');});
    }
  }
  render();
})();
