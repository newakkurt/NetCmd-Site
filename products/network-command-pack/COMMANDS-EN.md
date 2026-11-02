# Network Command Pack

NetCmd • Huawei VRP • Cisco IOS/IOS-XE • Aruba AOS-S/AOS-CX

**Release:** 1.0 content draft • **Price:** USD 19 one-time • **Language:** English

## Safety and compatibility

- Commands are reference examples; syntax and availability vary by model, software release, license and operating mode.
- Validate every command on the exact platform in a lab before production use.
- Interface names and VLAN IDs are examples; replace them with your own values.
- Configuration-changing commands are marked **CHANGE**; review impact and rollback before applying.
- This pack does not claim that every command was tested on every vendor/model.

## Command reference

### 1. Display the VLAN list

On Huawei VRP, display commands also work inside system-view; the 'do' prefix used on Cisco is not needed.

**Huawei VRP — CLI mode: User view / System view**

```text
display vlan
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show vlan brief
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show vlan
```

**Type:** READ — show/display reference

---

### 2. Interface IP summary

All three platforms show interface name, IP address and status (up/down) columns.

**Huawei VRP — CLI mode: User view**

```text
display ip interface brief
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show ip interface brief
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show ip interface brief
```

**Type:** READ — show/display reference

---

### 3. Display the running configuration

On Huawei, use 'display saved-configuration' to see the saved configuration.

**Huawei VRP — CLI mode: User view**

```text
display current-configuration
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show running-config
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show running-config
```

**Type:** READ — show/display reference

---

### 4. Save the configuration

Huawei's 'save' asks for confirmation (Y/N); handle this prompt separately in automation (Netmiko).

**Huawei VRP — CLI mode: User view**

```text
save
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
write memory
! or
copy running-config startup-config
```

**Aruba AOS-S / AOS-CX — CLI mode: Manager**

```text
write memory
```

**Type:** CHANGE — writes the running configuration to startup storage

---

### 5. Display the MAC address table

For a specific MAC use 'address <mac>' on Cisco and 'display mac-address <mac>' on Huawei.

**Huawei VRP — CLI mode: User view**

```text
display mac-address
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show mac address-table
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show mac-address-table
```

**Type:** READ — show/display reference

---

### 6. Display the ARP table

Only meaningful on devices that have L3 interfaces.

**Huawei VRP — CLI mode: User view**

```text
display arp
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show ip arp
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show arp
```

**Type:** READ — show/display reference

---

### 7. Display the routing table

On Huawei the table is called 'routing-table', not 'route'.

**Huawei VRP — CLI mode: User view**

```text
display ip routing-table
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show ip route
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show ip route
```

**Type:** READ — show/display reference

---

### 8. Software version and uptime

The output includes uptime, model and image details; it is the first command checked in inventory automation.

**Huawei VRP — CLI mode: User view**

```text
display version
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show version
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show version
```

**Type:** READ — show/display reference

---

### 9. Interface status summary

Cisco output also includes VLAN, duplex and speed columns; Huawei 'brief' output shows PHY/Protocol state.

**Huawei VRP — CLI mode: User view**

```text
display interface brief
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show interfaces status
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show interface brief
```

**Type:** READ — show/display reference

---

### 10. Create a VLAN

On Huawei, 'vlan batch 10 20 30' can create several VLANs at once.

**Huawei VRP — CLI mode: System view**

```text
vlan 10
description USERS
```

**Cisco IOS / IOS-XE — CLI mode: Global configuration**

```text
vlan 10
name USERS
```

**Aruba AOS-S / AOS-CX — CLI mode: Global configuration**

```text
vlan 10
name USERS
```

**Type:** CHANGE — modifies configuration

---

### 11. Configure an access port

Huawei interface names look like GigabitEthernet0/0/1; AOS-CX uses 1/1/1 (member/slot/port).

**Huawei VRP — CLI mode: Interface view**

```text
interface GigabitEthernet0/0/1
port link-type access
port default vlan 10
```

**Cisco IOS / IOS-XE — CLI mode: Interface configuration**

```text
interface GigabitEthernet1/0/1
switchport mode access
switchport access vlan 10
```

**Aruba AOS-S / AOS-CX — CLI mode: Interface configuration**

```text
interface 1/1/1
no routing
vlan access 10
```

**Type:** CHANGE — modifies configuration

---

### 12. Configure a trunk port

On Huawei the allow-pass list is space-separated (not comma-separated). On some Cisco platforms 'switchport trunk encapsulation dot1q' is needed first.

**Huawei VRP — CLI mode: Interface view**

```text
interface GigabitEthernet0/0/48
port link-type trunk
port trunk allow-pass vlan 10 20
```

**Cisco IOS / IOS-XE — CLI mode: Interface configuration**

```text
interface GigabitEthernet1/0/48
switchport mode trunk
switchport trunk allowed vlan 10,20
```

**Aruba AOS-S / AOS-CX — CLI mode: Interface configuration**

```text
interface 1/1/48
no routing
vlan trunk native 1
vlan trunk allowed 10,20
```

**Type:** CHANGE — modifies configuration

---

### 13. Enable DHCP Snooping

Uplink and DHCP server ports must be trusted; otherwise legitimate DHCP replies are dropped.

**Huawei VRP — CLI mode: System view + Interface**

```text
dhcp enable
dhcp snooping enable
vlan 10
dhcp snooping enable
interface GigabitEthernet0/0/48
dhcp snooping trusted
```

**Cisco IOS / IOS-XE — CLI mode: Global + Interface**

```text
ip dhcp snooping
ip dhcp snooping vlan 10
interface GigabitEthernet1/0/48
ip dhcp snooping trust
```

**Aruba AOS-S / AOS-CX — CLI mode: Global + Interface**

```text
dhcpv4-snooping
vlan 10
dhcpv4-snooping
interface 1/1/48
dhcpv4-snooping trust
```

**Type:** CHANGE — modifies configuration

---

### 14. DHCP Snooping binding table

IPSG and DAI depend on this table; if it is empty, these features can block all traffic.

**Huawei VRP — CLI mode: User view**

```text
display dhcp snooping user-bind all
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show ip dhcp snooping binding
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show dhcpv4-snooping binding
```

**Type:** READ — show/display reference

---

### 15. IP Source Guard (IPSG)

DHCP Snooping must be running first. The Aruba command may vary by software version; verify in a lab first.

**Huawei VRP — CLI mode: Interface view**

```text
interface GigabitEthernet0/0/1
ip source check user-bind enable
```

**Cisco IOS / IOS-XE — CLI mode: Interface configuration**

```text
interface GigabitEthernet1/0/1
ip verify source
```

**Aruba AOS-S / AOS-CX — CLI mode: Interface configuration**

```text
interface 1/1/1
ip source-lockdown
```

**Type:** CHANGE — modifies configuration

---

### 16. Dynamic ARP Inspection (DAI)

ARP inspection must be disabled (trusted) on trusted uplink ports. Verify the Aruba command against your software version.

**Huawei VRP — CLI mode: Interface view**

```text
interface GigabitEthernet0/0/1
arp anti-attack check user-bind enable
```

**Cisco IOS / IOS-XE — CLI mode: Global + Interface**

```text
ip arp inspection vlan 10
interface GigabitEthernet1/0/48
ip arp inspection trust
```

**Aruba AOS-S / AOS-CX — CLI mode: VLAN context**

```text
vlan 10
arp inspection
```

**Type:** CHANGE — modifies configuration

---

### 17. Set the Spanning Tree mode

In mixed-vendor networks, test root and BPDU behavior separately for Cisco Rapid-PVST+ vs Huawei RSTP/MSTP compatibility.

**Huawei VRP — CLI mode: System view**

```text
stp mode rstp
```

**Cisco IOS / IOS-XE — CLI mode: Global configuration**

```text
spanning-tree mode rapid-pvst
```

**Aruba AOS-S / AOS-CX — CLI mode: Global configuration**

```text
spanning-tree mode rpvst
```

**Type:** CHANGE — modifies configuration

---

### 18. Display Spanning Tree status

Use it to check the root bridge and port roles (root/designated/alternate).

**Huawei VRP — CLI mode: User view**

```text
display stp brief
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show spanning-tree
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show spanning-tree
```

**Type:** READ — show/display reference

---

### 19. LACP port channel (LAG)

On Huawei, create the Eth-Trunk first and add members under the interface or with trunkport.

**Huawei VRP — CLI mode: System view**

```text
interface Eth-Trunk 1
mode lacp-static
trunkport GigabitEthernet 0/0/47 to 0/0/48
```

**Cisco IOS / IOS-XE — CLI mode: Interface configuration**

```text
interface range GigabitEthernet1/0/47-48
channel-group 1 mode active
```

**Aruba AOS-S / AOS-CX — CLI mode: Global + Interface**

```text
interface lag 1
lacp mode active
interface 1/1/47
lag 1
```

**Type:** CHANGE — modifies configuration

---

### 20. Configure an NTP server

Use the same NTP source on all devices for log correlation and certificate validation.

**Huawei VRP — CLI mode: System view**

```text
ntp-service unicast-server 10.0.0.1
```

**Cisco IOS / IOS-XE — CLI mode: Global configuration**

```text
ntp server 10.0.0.1
```

**Aruba AOS-S / AOS-CX — CLI mode: Global configuration**

```text
ntp server 10.0.0.1
```

**Type:** CHANGE — modifies configuration

---

### 21. Display log entries

On Huawei the log buffer is called 'logbuffer'.

**Huawei VRP — CLI mode: User view**

```text
display logbuffer
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show logging
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show logging
```

**Type:** READ — show/display reference

---

### 22. Display LLDP neighbors

One of the most practical commands for topology discovery and patch panel verification.

**Huawei VRP — CLI mode: User view**

```text
display lldp neighbor brief
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show lldp neighbors
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show lldp neighbor-info
```

**Type:** READ — show/display reference

---

### 23. Interface details and error counters

CRC, input error and drop counters are the first indicators of physical-layer problems.

**Huawei VRP — CLI mode: User view**

```text
display interface GigabitEthernet 0/0/1
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show interfaces GigabitEthernet1/0/1
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show interface 1/1/1
```

**Type:** READ — show/display reference

---

### 24. Shut down / enable an interface

On Huawei, negation uses 'undo' instead of 'no'.

**Huawei VRP — CLI mode: Interface view**

```text
shutdown
undo shutdown
```

**Cisco IOS / IOS-XE — CLI mode: Interface configuration**

```text
shutdown
no shutdown
```

**Aruba AOS-S / AOS-CX — CLI mode: Interface configuration**

```text
shutdown
no shutdown
```

**Type:** CHANGE — modifies configuration

---

### 25. Create a VLAN interface (SVI)

On Huawei the interface name is written Vlanif10.

**Huawei VRP — CLI mode: System view**

```text
interface Vlanif10
ip address 10.10.10.1 255.255.255.0
```

**Cisco IOS / IOS-XE — CLI mode: Global configuration**

```text
interface vlan 10
ip address 10.10.10.1 255.255.255.0
```

**Aruba AOS-S / AOS-CX — CLI mode: Global configuration**

```text
interface vlan 10
ip address 10.10.10.1/24
```

**Type:** CHANGE — modifies configuration

---

### 26. Add a static default route

On Huawei the command is 'ip route-static'; Aruba AOS-CX uses CIDR notation.

**Huawei VRP — CLI mode: System view**

```text
ip route-static 0.0.0.0 0.0.0.0 10.0.0.1
```

**Cisco IOS / IOS-XE — CLI mode: Global configuration**

```text
ip route 0.0.0.0 0.0.0.0 10.0.0.1
```

**Aruba AOS-S / AOS-CX — CLI mode: Global configuration**

```text
ip route 0.0.0.0/0 10.0.0.1
```

**Type:** CHANGE — modifies configuration

---

### 27. Display CPU usage

Checking the 1/5-minute averages along with instant load helps distinguish transient spikes.

**Huawei VRP — CLI mode: User view**

```text
display cpu-usage
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show processes cpu sorted
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show system resource-utilization
```

**Type:** READ — show/display reference

---

### 28. SFP / transceiver info and DOM

Rx/Tx power levels (dBm) are used to diagnose fiber link problems.

**Huawei VRP — CLI mode: User view**

```text
display transceiver interface GigabitEthernet 0/0/1 verbose
```

**Cisco IOS / IOS-XE — CLI mode: Privileged EXEC**

```text
show interfaces transceiver detail
```

**Aruba AOS-S / AOS-CX — CLI mode: Operator / Manager**

```text
show interface transceiver
```

**Type:** READ — show/display reference

---

## Operational checklist

1. Confirm vendor, model, OS family and software release.
2. Capture current configuration and relevant show/display output.
3. Check maintenance window, impact, dependencies and rollback.
4. Apply one change at a time; verify state and logs.
5. Save configuration only after successful validation.

---
NetCmd Network Command Pack • Content draft. Verify vendor documentation before production changes.
 
### 29. Display detailed LLDP neighbors
**Huawei VRP:** `display lldp neighbor`  
**Cisco IOS/IOS-XE:** `show lldp neighbors detail`  
**Aruba AOS-S:** `show lldp info remote-device`  
**Aruba AOS-CX:** `show lldp neighbor-info detail`  
**Type:** READ. Inspect neighbor identity and remote port details.

### 30. Display CDP neighbors (Cisco)
`show cdp neighbors`  
`show cdp neighbors detail`  
**Type:** READ. CDP is Cisco-specific; prefer LLDP in multi-vendor networks.

### 31. Test reachability with ping
**Huawei / Cisco / Aruba:** `ping 10.0.0.1`  
**Type:** TEST. Consider source interface, VRF and ICMP filtering.

### 32. Trace the network path
**Huawei VRP:** `tracert 10.0.0.1`  
**Cisco / Aruba:** `traceroute 10.0.0.1`  
**Type:** TEST. Intermediate hops are shown; filtering may affect results.

### 33. Display LAG / EtherChannel status
**Huawei VRP:** `display eth-trunk`  
**Cisco IOS/IOS-XE:** `show etherchannel summary`  
**Aruba AOS-S:** `show trunks` and `show lacp`  
**Aruba AOS-CX:** `show lacp aggregates`  
**Type:** READ. Check whether member links joined the aggregate.

### 34. Inspect STP root and port roles
**Huawei VRP:** `display stp`  
**Cisco IOS/IOS-XE:** `show spanning-tree root`  
**Aruba AOS-S/AOS-CX:** `show spanning-tree`  
**Type:** READ. An unexpected root bridge can alter traffic paths.

### 35. Display optical transceiver information
**Huawei VRP:** `display transceiver interface GigabitEthernet 0/0/1 verbose`  
**Cisco IOS/IOS-XE:** `show interfaces transceiver detail`  
**Aruba AOS-CX:** `show interface transceiver`  
**Type:** READ. DOM support depends on model and optic.

### 36. Display PoE status
**Huawei VRP:** `display poe power` and `display poe interface`  
**Cisco IOS/IOS-XE:** `show power inline`  
**Aruba AOS-S/AOS-CX:** `show power-over-ethernet`  
**Type:** READ. Verify command support for the exact model and release.

### 37. Display CPU utilization
**Huawei VRP:** `display cpu-usage`  
**Cisco IOS/IOS-XE:** `show processes cpu`  
**Aruba AOS-S:** `show cpu`  
**Aruba AOS-CX:** `show system resource-utilization`  
**Type:** READ. Correlate instantaneous values with processes and trends.

### 38. Display memory utilization
**Huawei VRP:** `display memory-usage`  
**Cisco IOS/IOS-XE:** `show processes memory`  
**Aruba AOS-CX:** `show system resource-utilization`  
**Type:** READ. Command availability and output vary by release.

### 39. Display clock and NTP status
**Huawei VRP:** `display clock` and `display ntp-service status`  
**Cisco IOS/IOS-XE:** `show clock detail` and `show ntp status`  
**Aruba AOS-S/AOS-CX:** `show time` and `show ntp status`  
**Type:** READ. Clock drift damages log correlation.

### 40. Filter the MAC table by VLAN
**Huawei VRP:** `display mac-address vlan 10`  
**Cisco IOS/IOS-XE:** `show mac address-table vlan 10`  
**Aruba AOS-S/AOS-CX:** `show mac-address vlan 10`  
**Type:** READ. Find learned endpoints and their ports in a VLAN.
