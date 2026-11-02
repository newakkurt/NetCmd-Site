# Ağ Komut Paketi

NetCmd • Huawei VRP • Cisco IOS/IOS-XE • Aruba AOS-S/AOS-CX

**Sürüm:** 1.0 içerik taslağı • **Fiyat:** Tek seferlik 19 USD • **Dil:** Türkçe

## Güvenlik ve uyumluluk

- Komutlar referans örnekleridir; sözdizimi ve kullanılabilirlik model, yazılım sürümü, lisans ve çalışma moduna göre değişebilir.
- Üretimde kullanmadan önce komutları aynı platformda laboratuvar ortamında doğrulayın.
- Arayüz adları ve VLAN numaraları örnektir; kendi değerlerinizle değiştirin.
- Yapılandırmayı değiştiren komutlar **DEĞİŞİKLİK** olarak işaretlenmiştir; uygulamadan önce etkiyi ve geri dönüş planını inceleyin.
- Bu paket her komutun her marka/modelde test edildiğini iddia etmez.

## Komut referansı

### 1. VLAN listesini görüntüleme

Huawei VRP'de display komutları system-view içinde de çalışır; Cisco'daki 'do' öneki gerekmez.

**Huawei VRP — CLI modu: User view / System view**

```text
display vlan
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show vlan brief
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show vlan
```

**Tür:** OKUMA — show/display referansı

---

### 2. Arayüz IP özeti

Üç platformda da çıktı arayüz adı, IP ve durum (up/down) kolonlarını içerir.

**Huawei VRP — CLI modu: User view**

```text
display ip interface brief
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show ip interface brief
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show ip interface brief
```

**Tür:** OKUMA — show/display referansı

---

### 3. Çalışan konfigürasyonu görüntüleme

Huawei'de kayıtlı konfigürasyon için 'display saved-configuration' kullanılır.

**Huawei VRP — CLI modu: User view**

```text
display current-configuration
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show running-config
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show running-config
```

**Tür:** OKUMA — show/display referansı

---

### 4. Konfigürasyonu kaydetme

Huawei'de 'save' onay (Y/N) ister; otomasyonda (Netmiko) bu prompt ayrıca ele alınmalıdır.

**Huawei VRP — CLI modu: User view**

```text
save
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
write memory
! veya
copy running-config startup-config
```

**Aruba AOS-S / AOS-CX — CLI modu: Manager**

```text
write memory
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı diske kaydeder

---

### 5. MAC adres tablosunu görüntüleme

Belirli bir MAC için Cisco'da 'address <mac>', Huawei'de 'display mac-address <mac>' kullanılır.

**Huawei VRP — CLI modu: User view**

```text
display mac-address
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show mac address-table
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show mac-address-table
```

**Tür:** OKUMA — show/display referansı

---

### 6. ARP tablosunu görüntüleme

Sadece L3 arayüzü olan cihazlarda anlamlı çıktı verir.

**Huawei VRP — CLI modu: User view**

```text
display arp
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show ip arp
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show arp
```

**Tür:** OKUMA — show/display referansı

---

### 7. Routing tablosunu görüntüleme

Huawei'de tablo adı 'routing-table'dır; 'route' değil.

**Huawei VRP — CLI modu: User view**

```text
display ip routing-table
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show ip route
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show ip route
```

**Tür:** OKUMA — show/display referansı

---

### 8. Yazılım versiyonu ve uptime

Çıktıda uptime, model ve image bilgisi yer alır; envanter otomasyonunda ilk bakılan komuttur.

**Huawei VRP — CLI modu: User view**

```text
display version
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show version
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show version
```

**Tür:** OKUMA — show/display referansı

---

### 9. Arayüz durum özeti

Cisco çıktısı VLAN, duplex ve hız kolonlarını da verir; Huawei 'brief' çıktısı PHY/Protocol durumunu gösterir.

**Huawei VRP — CLI modu: User view**

```text
display interface brief
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show interfaces status
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show interface brief
```

**Tür:** OKUMA — show/display referansı

---

### 10. VLAN oluşturma

Huawei'de birden fazla VLAN için 'vlan batch 10 20 30' kullanılabilir.

**Huawei VRP — CLI modu: System view**

```text
vlan 10
description USERS
```

**Cisco IOS / IOS-XE — CLI modu: Global configuration**

```text
vlan 10
name USERS
```

**Aruba AOS-S / AOS-CX — CLI modu: Global configuration**

```text
vlan 10
name USERS
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 11. Access port yapılandırma

Huawei'de arayüz adları GigabitEthernet0/0/1 biçimindedir; AOS-CX'te 1/1/1 (member/slot/port).

**Huawei VRP — CLI modu: Interface view**

```text
interface GigabitEthernet0/0/1
port link-type access
port default vlan 10
```

**Cisco IOS / IOS-XE — CLI modu: Interface configuration**

```text
interface GigabitEthernet1/0/1
switchport mode access
switchport access vlan 10
```

**Aruba AOS-S / AOS-CX — CLI modu: Interface configuration**

```text
interface 1/1/1
no routing
vlan access 10
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 12. Trunk port yapılandırma

Huawei'de allow-pass listesi boşlukla ayrılır (virgül değil). Cisco'da bazı platformlarda önce 'switchport trunk encapsulation dot1q' gerekir.

**Huawei VRP — CLI modu: Interface view**

```text
interface GigabitEthernet0/0/48
port link-type trunk
port trunk allow-pass vlan 10 20
```

**Cisco IOS / IOS-XE — CLI modu: Interface configuration**

```text
interface GigabitEthernet1/0/48
switchport mode trunk
switchport trunk allowed vlan 10,20
```

**Aruba AOS-S / AOS-CX — CLI modu: Interface configuration**

```text
interface 1/1/48
no routing
vlan trunk native 1
vlan trunk allowed 10,20
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 13. DHCP Snooping etkinleştirme

Uplink / DHCP sunucu yönündeki portlar trusted olmalıdır; aksi halde meşru DHCP cevapları düşer.

**Huawei VRP — CLI modu: System view + Interface**

```text
dhcp enable
dhcp snooping enable
vlan 10
dhcp snooping enable
interface GigabitEthernet0/0/48
dhcp snooping trusted
```

**Cisco IOS / IOS-XE — CLI modu: Global + Interface**

```text
ip dhcp snooping
ip dhcp snooping vlan 10
interface GigabitEthernet1/0/48
ip dhcp snooping trust
```

**Aruba AOS-S / AOS-CX — CLI modu: Global + Interface**

```text
dhcpv4-snooping
vlan 10
dhcpv4-snooping
interface 1/1/48
dhcpv4-snooping trust
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 14. DHCP Snooping binding tablosu

IPSG ve DAI bu tabloya dayanır; tablo boşsa bu özellikler tüm trafiği engelleyebilir.

**Huawei VRP — CLI modu: User view**

```text
display dhcp snooping user-bind all
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show ip dhcp snooping binding
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show dhcpv4-snooping binding
```

**Tür:** OKUMA — show/display referansı

---

### 15. IP Source Guard (IPSG)

Önce DHCP Snooping çalışıyor olmalıdır. Aruba komutu yazılım sürümüne göre değişebilir; önce lab'da doğrulayın.

**Huawei VRP — CLI modu: Interface view**

```text
interface GigabitEthernet0/0/1
ip source check user-bind enable
```

**Cisco IOS / IOS-XE — CLI modu: Interface configuration**

```text
interface GigabitEthernet1/0/1
ip verify source
```

**Aruba AOS-S / AOS-CX — CLI modu: Interface configuration**

```text
interface 1/1/1
ip source-lockdown
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 16. Dynamic ARP Inspection (DAI)

Trusted uplink portlarında ARP inspection devre dışı bırakılmalıdır. Aruba komutu sürüme göre doğrulanmalıdır.

**Huawei VRP — CLI modu: Interface view**

```text
interface GigabitEthernet0/0/1
arp anti-attack check user-bind enable
```

**Cisco IOS / IOS-XE — CLI modu: Global + Interface**

```text
ip arp inspection vlan 10
interface GigabitEthernet1/0/48
ip arp inspection trust
```

**Aruba AOS-S / AOS-CX — CLI modu: VLAN context**

```text
vlan 10
arp inspection
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 17. Spanning Tree modunu ayarlama

Karışık vendor ortamlarında Cisco Rapid-PVST+ ile Huawei RSTP/MSTP arasında uyumluluk için root ve BPDU davranışı ayrıca test edilmelidir.

**Huawei VRP — CLI modu: System view**

```text
stp mode rstp
```

**Cisco IOS / IOS-XE — CLI modu: Global configuration**

```text
spanning-tree mode rapid-pvst
```

**Aruba AOS-S / AOS-CX — CLI modu: Global configuration**

```text
spanning-tree mode rpvst
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 18. Spanning Tree durumunu görüntüleme

Root bridge ve port rollerini (root/designated/alternate) kontrol etmek için kullanılır.

**Huawei VRP — CLI modu: User view**

```text
display stp brief
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show spanning-tree
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show spanning-tree
```

**Tür:** OKUMA — show/display referansı

---

### 19. LACP port kanalı (LAG)

Huawei'de Eth-Trunk önce oluşturulur, üyeler arayüz altında eklenir veya trunkport ile toplu verilir.

**Huawei VRP — CLI modu: System view**

```text
interface Eth-Trunk 1
mode lacp-static
trunkport GigabitEthernet 0/0/47 to 0/0/48
```

**Cisco IOS / IOS-XE — CLI modu: Interface configuration**

```text
interface range GigabitEthernet1/0/47-48
channel-group 1 mode active
```

**Aruba AOS-S / AOS-CX — CLI modu: Global + Interface**

```text
interface lag 1
lacp mode active
interface 1/1/47
lag 1
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 20. NTP sunucusu tanımlama

Log korelasyonu ve sertifika doğrulaması için tüm cihazlarda aynı NTP kaynağı kullanılmalıdır.

**Huawei VRP — CLI modu: System view**

```text
ntp-service unicast-server 10.0.0.1
```

**Cisco IOS / IOS-XE — CLI modu: Global configuration**

```text
ntp server 10.0.0.1
```

**Aruba AOS-S / AOS-CX — CLI modu: Global configuration**

```text
ntp server 10.0.0.1
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 21. Log kayıtlarını görüntüleme

Huawei'de log tamponu 'logbuffer' olarak adlandırılır.

**Huawei VRP — CLI modu: User view**

```text
display logbuffer
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show logging
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show logging
```

**Tür:** OKUMA — show/display referansı

---

### 22. LLDP komşularını görüntüleme

Topoloji keşfi ve patch panel doğrulaması için en pratik komutlardan biridir.

**Huawei VRP — CLI modu: User view**

```text
display lldp neighbor brief
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show lldp neighbors
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show lldp neighbor-info
```

**Tür:** OKUMA — show/display referansı

---

### 23. Arayüz detayı ve hata sayaçları

CRC, input error ve drop sayaçları fiziksel katman sorunlarının ilk göstergesidir.

**Huawei VRP — CLI modu: User view**

```text
display interface GigabitEthernet 0/0/1
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show interfaces GigabitEthernet1/0/1
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show interface 1/1/1
```

**Tür:** OKUMA — show/display referansı

---

### 24. Arayüzü kapatma / açma

Huawei'de negasyon 'no' değil 'undo' ile yapılır.

**Huawei VRP — CLI modu: Interface view**

```text
shutdown
undo shutdown
```

**Cisco IOS / IOS-XE — CLI modu: Interface configuration**

```text
shutdown
no shutdown
```

**Aruba AOS-S / AOS-CX — CLI modu: Interface configuration**

```text
shutdown
no shutdown
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 25. VLAN arayüzü (SVI) oluşturma

Huawei'de arayüz adı Vlanif10 biçimindedir.

**Huawei VRP — CLI modu: System view**

```text
interface Vlanif10
ip address 10.10.10.1 255.255.255.0
```

**Cisco IOS / IOS-XE — CLI modu: Global configuration**

```text
interface vlan 10
ip address 10.10.10.1 255.255.255.0
```

**Aruba AOS-S / AOS-CX — CLI modu: Global configuration**

```text
interface vlan 10
ip address 10.10.10.1/24
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 26. Statik default route ekleme

Huawei'de komut 'ip route-static'tir; Aruba AOS-CX CIDR gösterimi kullanır.

**Huawei VRP — CLI modu: System view**

```text
ip route-static 0.0.0.0 0.0.0.0 10.0.0.1
```

**Cisco IOS / IOS-XE — CLI modu: Global configuration**

```text
ip route 0.0.0.0 0.0.0.0 10.0.0.1
```

**Aruba AOS-S / AOS-CX — CLI modu: Global configuration**

```text
ip route 0.0.0.0/0 10.0.0.1
```

**Tür:** DEĞİŞİKLİK — yapılandırmayı değiştirir

---

### 27. CPU kullanımını görüntüleme

Anlık yük ile birlikte son 1/5 dakika ortalamasına bakmak geçici spike'ları ayırt etmeyi sağlar.

**Huawei VRP — CLI modu: User view**

```text
display cpu-usage
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show processes cpu sorted
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show system resource-utilization
```

**Tür:** OKUMA — show/display referansı

---

### 28. SFP / transceiver bilgisi ve DOM

Rx/Tx güç seviyeleri (dBm) fiber hat sorunlarını teşhis etmek için kullanılır.

**Huawei VRP — CLI modu: User view**

```text
display transceiver interface GigabitEthernet 0/0/1 verbose
```

**Cisco IOS / IOS-XE — CLI modu: Privileged EXEC**

```text
show interfaces transceiver detail
```

**Aruba AOS-S / AOS-CX — CLI modu: Operator / Manager**

```text
show interface transceiver
```

**Tür:** OKUMA — show/display referansı

---

## Operasyon kontrol listesi

1. Marka, model, işletim sistemi ailesi ve yazılım sürümünü doğrulayın.
2. Mevcut konfigürasyonu ve ilgili show/display çıktılarını yedekleyin.
3. Bakım penceresi, etki, bağımlılıklar ve geri dönüş planını kontrol edin.
4. Her seferinde tek değişiklik uygulayın; durumu ve logları doğrulayın.
5. Konfigürasyonu yalnızca doğrulama başarılı olduktan sonra kaydedin.

---
NetCmd Ağ Komut Paketi • İçerik taslağı. Üretim değişikliklerinden önce üretici dokümantasyonunu doğrulayın.
 
### 29. LLDP komşu detayını görüntüleme
**Huawei VRP:** `display lldp neighbor`  
**Cisco IOS/IOS-XE:** `show lldp neighbors detail`  
**Aruba AOS-S:** `show lldp info remote-device`  
**Aruba AOS-CX:** `show lldp neighbor-info detail`  
**Tür:** OKUMA. Komşu cihaz ve port bilgilerini inceler.

### 30. CDP komşularını görüntüleme (Cisco)
`show cdp neighbors`  
`show cdp neighbors detail`  
**Tür:** OKUMA. CDP Cisco'ya özgüdür; çok üreticili ağlarda LLDP tercih edilir.

### 31. Ping ile erişilebilirlik testi
**Huawei / Cisco / Aruba:** `ping 10.0.0.1`  
**Tür:** TEST. Kaynak arayüzü, VRF'i ve ICMP filtrelerini dikkate alın.

### 32. Traceroute ile yolu inceleme
**Huawei VRP:** `tracert 10.0.0.1`  
**Cisco / Aruba:** `traceroute 10.0.0.1`  
**Tür:** TEST. Ara atlamaları gösterir; filtreleme çıktıyı etkileyebilir.

### 33. LAG / EtherChannel durumunu görüntüleme
**Huawei VRP:** `display eth-trunk`  
**Cisco IOS/IOS-XE:** `show etherchannel summary`  
**Aruba AOS-S:** `show trunks` ve `show lacp`  
**Aruba AOS-CX:** `show lacp aggregates`  
**Tür:** OKUMA. Üye bağlantıların topluluğa katılımını denetler.

### 34. STP kök ve port rollerini inceleme
**Huawei VRP:** `display stp`  
**Cisco IOS/IOS-XE:** `show spanning-tree root`  
**Aruba AOS-S/AOS-CX:** `show spanning-tree`  
**Tür:** OKUMA. Beklenmeyen root bridge trafik yolunu değiştirebilir.

### 35. Optik modül bilgisi
**Huawei VRP:** `display transceiver interface GigabitEthernet 0/0/1 verbose`  
**Cisco IOS/IOS-XE:** `show interfaces transceiver detail`  
**Aruba AOS-CX:** `show interface transceiver`  
**Tür:** OKUMA. DOM sensör desteği model ve optiğe bağlıdır.

### 36. PoE durumunu görüntüleme
**Huawei VRP:** `display poe power` ve `display poe interface`  
**Cisco IOS/IOS-XE:** `show power inline`  
**Aruba AOS-S/AOS-CX:** `show power-over-ethernet`  
**Tür:** OKUMA. Komut desteğini model/yazılım sürümünde doğrulayın.

### 37. CPU kullanımını görüntüleme
**Huawei VRP:** `display cpu-usage`  
**Cisco IOS/IOS-XE:** `show processes cpu`  
**Aruba AOS-S:** `show cpu`  
**Aruba AOS-CX:** `show system resource-utilization`  
**Tür:** OKUMA. Anlık değerleri süreç ve zaman trendiyle değerlendirin.

### 38. Bellek kullanımını görüntüleme
**Huawei VRP:** `display memory-usage`  
**Cisco IOS/IOS-XE:** `show processes memory`  
**Aruba AOS-CX:** `show system resource-utilization`  
**Tür:** OKUMA. Çıktı ve komut desteği sürüme göre değişebilir.

### 39. Saat ve NTP durumunu görüntüleme
**Huawei VRP:** `display clock` ve `display ntp-service status`  
**Cisco IOS/IOS-XE:** `show clock detail` ve `show ntp status`  
**Aruba AOS-S/AOS-CX:** `show time` ve `show ntp status`  
**Tür:** OKUMA. Saat sapması log korelasyonunu bozar.

### 40. VLAN'a göre MAC tablosunu filtreleme
**Huawei VRP:** `display mac-address vlan 10`  
**Cisco IOS/IOS-XE:** `show mac address-table vlan 10`  
**Aruba AOS-S/AOS-CX:** `show mac-address vlan 10`  
**Tür:** OKUMA. VLAN içindeki uç cihazların öğrenildiği portları bulmaya yardım eder.
