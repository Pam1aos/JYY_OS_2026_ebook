# 计算机系统安全：隔离、访问控制与攻击面

> **课程**：2026 春季学期《操作系统原理》  
> **讲师**：蒋炎岩（jyy）  
> **官方课程主页**：<https://jyywiki.cn/OS/2026/>  
> **官方讲义**：<https://jyywiki.cn/OS/2026/lect28.md>  
> **视频来源**：[Bilibili BV1qkEX6FEb5](https://www.bilibili.com/video/BV1qkEX6FEb5/)  
> **版权说明**：课程讲义与幻灯片归蒋炎岩所有，采用 [Creative Commons BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) 许可；本电子书是对课堂讲授的书面化重构，保留出处与许可说明。

## 导语：从“裸奔”进入安全世界

*(参考时间: 00:00)*

文件系统的接口、实现和崩溃一致性已经讲完。本讲讨论一个此前较少出现的问题：计算机系统安全。

在计算机发展的早期，安全几乎不存在。8086 真实模式可以让任何程序直接访问任何硬件和内存；没有操作系统 API 的权限检查，也没有进程隔离。互联网早期同样如此，用户密码明文传输，网站可以被轻易枚举和爆破。

只要系统只承载可有可无的娱乐信息，不安全或许还能被接受。但一旦涉及隐私、支付、身份和关键基础设施，安全性就会成为不可回避的问题。

```mermaid
flowchart TD
    HW["8086 真实模式<br/>无隔离、无权限"] --> BBS["BBS 明文密码<br/>可爆破、可钓鱼"]
    BBS --> NET["互联网承载隐私与支付"]
    NET --> NEED["安全成为基础需求"]
    NEED --> CIA["Confidentiality / Integrity / Availability"]
    CIA --> OS["操作系统访问控制与隔离机制"]
```

![8086 真实模式允许程序直接访问整个地址空间和硬件](images/shot_00_00_45.png)

---

## 1. 信息安全简介

### 1.1 回到没有保护的 8086 时代

*(参考时间: 01:00)*

8086 使用两个 16 位寄存器描述代码位置：

```text
CS = code segment
IP = instruction pointer
physical address = (CS << 4) + IP
```

这样最多可以寻址 1 MiB 物理内存。问题是 CPU 不检查访问者身份，也不区分内核和用户程序。Firmware 的只读代码虽然改不了，但任意程序都可以修改其他程序的内存、硬件寄存器和中断向量表。

16 位时代通过 `int` 指令调用系统服务：

```asm
int $x
```

CPU 根据中断号 `x` 找到中断向量表中的地址，再长跳到对应处理程序。它更像一个函数调用，而不是拥有权限边界的系统调用。程序可以改写中断向量，把系统调用引向自己的代码。

```mermaid
flowchart LR
    APP["应用程序"] --> INT["int x"]
    INT --> TABLE["0x0000 起始的中断向量表"]
    TABLE --> HANDLER["Firmware / 系统服务代码"]
    APP --> PATCH["也可写入中断向量和硬件状态"]
    PATCH --> TABLE
```

![16 位系统的 int 调用本质上是一次经中断向量表跳转的函数调用](images/shot_00_01_40.png)

### 1.2 病毒、加壳与 CIH

*(参考时间: 02:00)*

没有内存保护之后，病毒可以复制自己、感染其他程序，甚至破坏硬件。一个典型技术是“加壳”：

1. 在可执行文件中注入一段恶意代码；
2. 把程序入口改成恶意代码；
3. 恶意代码运行后，再跳回原入口；
4. 用户看到程序行为不变，但每次启动都会悄悄执行恶意逻辑。

```mermaid
flowchart LR
    ENTRY["ELF Entry"] --> SHELL["恶意壳代码"]
    SHELL --> PAYLOAD["复制、感染或破坏"]
    SHELL --> ORIGINAL["跳回原程序入口"]
    ORIGINAL --> NORMAL["正常界面与行为"]
```

![加壳可以在保持程序外观的同时劫持执行入口](images/shot_00_02_40.png)

CIH 是 16 位时代最著名的病毒之一，它的破坏不仅限于文件，还能影响主板 Flash 芯片。这说明“软件漏洞”在缺少隔离时可以直接变成物理世界中的破坏。

### 1.3 BBS 时代的明文与爆破

*(参考时间: 03:20)*

南京大学小百合和后来长期运行的水木社区代表了 BBS 时代。那时的网站大多使用 HTTP：

- 用户名和密码在网络上明文传输；
- 一个钓鱼路由器就能收集大量密码；
- 用户列表可以被程序枚举；
- 登录接口缺少速率限制和风控；
- 可以用密码字典持续尝试。

课堂回忆中，攻击者获得大量账号后，只是想让自己发的帖子进入“站内十大热门话题”。这件事如果放在今天，已经涉及未授权访问和个人信息风险。

![早期 BBS 用明文协议传输用户名和密码](images/shot_00_03_50.png)

```mermaid
sequenceDiagram
    participant User as 用户
    participant Router as 不可信路由器
    participant BBS as BBS 服务器
    User->>Router: username + password（明文）
    Router->>BBS: 转发登录请求
    Router-->>User: 正常返回页面
    Note over Router: 同时复制凭据
```

### 1.4 信息安全三要素

*(参考时间: 06:00)*

信息安全通常从三个目标理解：

#### Confidentiality，保密性

不想让别人看到的信息，别人看不到。

典型实现包括：

- 文件系统加密；
- 全盘加密；
- 手机中的安全计算区；
- 密钥与生物识别信息的安全存储。

手机中的安全芯片甚至不信任操作系统，认为操作系统本身也可能被攻破。

![保密性要求未授权者无法读取敏感信息](images/shot_00_06_20.png)

#### Integrity，完整性

不想让别人修改的数据，别人改不了。

课堂举了一个学长入侵教务系统的真实案例。攻击者向教务员发送一个 XSS 链接，获得教务员会话，进而能够以教务员身份查看和修改系统数据。即使最终没有修改成绩，这也同时破坏了保密性和完整性。

相关行为不是“技术恶作剧”，而可能构成破坏计算机信息系统等违法行为。

![教务系统入侵案例同时暴露了会话安全和完整性保护问题](images/shot_00_07_30.png)

#### Availability，可用性

自己的服务不能被别人恶意中断。

拒绝服务攻击不仅包括传统的 DDoS，也包括算法复杂性攻击：

- Fork bomb 持续创建进程，耗尽进程表；
- 超长输入让 AI 模型生成巨量 token；
- 精心构造大量哈希冲突，让哈希表退化为线性结构；
- 租用云主机发送高复杂度请求。

```mermaid
flowchart TD
    ATTACK["可用性攻击"] --> VOLUME["流量型 DDoS"]
    ATTACK --> RESOURCE["资源耗尽<br/>Fork bomb"]
    ATTACK --> COMPLEXITY["算法复杂性攻击"]
    COMPLEXITY --> HASH["哈希冲突"]
    COMPLEXITY --> PARSE["超长解析或计算"]
    COMPLEXITY --> LLM["模型生成长输出的成本"]
```

![可用性攻击可以让合法用户无法访问正常服务](images/shot_00_10_30.png)

一个健壮的哈希表实现需要在冲突过多时切换数据结构，例如把碰撞链转换为红黑树，降低最坏情况下的时间成本。

### 1.5 一分钟密码学

*(参考时间: 13:30)*

#### One-way function

单向函数满足：

- 正向 `f(x) = y` 容易计算；
- 已知 `y` 反推 `x` 极其困难；
- 找到两个不同输入产生相同输出也很难。

密码学哈希函数，例如 SHA-256，几乎表现得像随机函数。输入发生一位变化，输出会完全不同。

```mermaid
flowchart LR
    M["任意文件或消息"] --> HASH["SHA-256"]
    HASH --> DIGEST["固定长度摘要"]
    DIGEST --> CHECK["校验下载完整性"]
    DIGEST --> SIGN["与数字签名配合"]
```

![密码学哈希让文件摘要看起来像随机数](images/shot_00_14_00.png)

#### Trapdoor one-way function

陷门单向函数多了一个秘密 `t`：

- 没有 `t` 时，反向求解困难；
- 有 `t` 时，可以快速求逆。

公钥对应公开函数，私钥对应陷门。它有两种典型用法：

1. **加密**：任何人都能公开加密，只有私钥持有者能解密；
2. **签名**：只有私钥持有者能生成证明，任何人都能公开验证。

```mermaid
flowchart TD
    PUB["公开函数 f"] --> ENC["Bob 计算 f(message)"]
    ENC --> CIPHER["密文"]
    CIPHER --> DEC["Alice 用私钥 t 解密"]
    PUB --> VERIFY["验证者检查 f(response)"]
    PRIV["Alice 私钥 t"] --> RESPONSE["生成 response"]
```

![陷门函数可以同时实现保密通信和身份认证](images/shot_00_17_20.png)

### 1.6 区块链：全球共享的 Append-only Log

*(参考时间: 19:00)*

区块链可以理解为全球共同维护、难以篡改的 append-only 日志。每个新区块包含前序状态的哈希，形成链式证明。

课堂用“狗和骨头”做类比：

- 任何参与者都可以提交想 append 的内容；
- 必须先完成昂贵的 hash 搜索，也就是 proof-of-work；
- 找到有效结果后广播给其他人；
- 其他人验证并接受这个块；
- 出现分叉时，通常选择更长的链。

```mermaid
flowchart LR
    B0["Block n-1"] --> B1["Block n<br/>prev hash + data + nonce"]
    B1 --> B2["Block n+1"]
    POW["Proof of Work"] --> B1
    REPLICAS["全球副本"] --> AVAIL["高可用性"]
    B1 --> PUBLIC["所有人都可查看"]
    PUBLIC --> NO_CONF["没有保密性"]
```

![区块通过前序哈希与工作量证明形成全球共享日志](images/shot_00_21_20.png)

区块链协议本身也可以运行图灵完备的虚拟机。交易可以是一段代码，所有节点重放它并得到相同状态。这提供了分布式共识和高可用性，但并不意味着天然保密。

---

## 2. 访问控制

### 2.1 操作系统把对象访问收口到系统调用

*(参考时间: 24:00)*

现代操作系统已经提供了第一层保护：

- 每个进程拥有独立虚拟地址空间；
- 普通计算指令只能访问自己的地址空间；
- 对文件、设备、网络和进程等共享对象的访问必须通过系统调用；
- 系统调用是用户态和内核态之间的唯一受控入口。

```mermaid
flowchart LR
    PROCESS["进程地址空间"] --> USER["用户态计算"]
    USER --> SYSCALL["系统调用入口"]
    SYSCALL --> ACL["访问控制检查"]
    ACL -- "允许" --> OBJECT["操作系统对象"]
    ACL -- "拒绝" --> EACCES["EACCES / Permission denied"]
```

![虚拟内存隔离和系统调用边界构成访问控制的基础](images/shot_00_25_00.png)

系统调用同时包含两个层面：

- **机制**：如何执行操作并检查访问；
- **策略**：哪些进程可以访问哪些对象。

### 2.2 访问控制矩阵

*(参考时间: 27:00)*

理论上，访问控制可以表示为一张巨大的矩阵：

| 进程 | 对象 | 操作 | 是否允许 |
|---|---|---|---|
| 1 | `/etc/passwd` | read | 是 |
| 1 | `/etc/passwd` | write | 是 |
| 4132 | `/etc/passwd` | write | 否 |
| 4132 | `/tmp/hello.txt` | write | 是 |

这个矩阵的规模是：

```text
进程数 × 对象数 × 操作数
```

系统中可能有几万个进程和几百万个对象，直接存储完整矩阵不可行。因此需要从矩阵中提取低秩结构，或者只维护一小部分最关键的关系。

```mermaid
flowchart TD
    MATRIX["Access Control Matrix<br/>(Process, Object, Action) -> Bool"] --> LOWRANK["低秩分解"]
    LOWRANK --> UID["UID / GID / Mode"]
    LOWRANK --> ACL["ACL"]
    LOWRANK --> LABEL["AppArmor / SELinux"]
    LOWRANK --> CAP["Capabilities"]
    LOWRANK --> BPF["seccomp / LSM BPF"]
```

![访问控制矩阵可以从身份、对象、程序或系统调用等维度近似分解](images/shot_00_28_00.png)

### 2.3 UNIX 的身份模型：uid、gid 和 mode

*(参考时间: 29:30)*

UNIX 用少量整数近似表达身份关系：

- `uid`：用户身份；
- `gid`：用户组身份；
- `mode`：owner、group、other 的 `rwx` 权限。

规则包括：

- `uid == 0` 是 root；
- root 通常可以访问所有对象；
- root 可以切换到其他 uid；
- 子进程继承父进程 uid；
- 一个用户可以属于多个组。

```mermaid
flowchart TD
    USER["用户"] --> UID["UID"]
    USER --> GID["多个 GID"]
    UID --> MODE["文件 mode"]
    GID --> MODE
    MODE --> OWNER["owner: rwx"]
    MODE --> GROUP["group: rwx"]
    MODE --> OTHER["other: rwx"]
```

![UNIX 把巨大的访问矩阵压缩为 uid、gid 和 mode](images/shot_00_30_30.png)

### 2.4 `/etc/passwd` 与用户数据库

*(参考时间: 32:00)*

传统用户信息保存在 `/etc/passwd`：

```text
username:password:uid:gid:comment:home:shell
```

现代系统通常把密码哈希放进只有 root 可读的 shadow 文件。普通用户可以读取用户名和 uid，但不能修改自己的身份记录。

登录过程可以理解为：

1. 登录程序以 root 权限运行；
2. 校验用户密码哈希；
3. 通过 `setuid` 切换到目标用户；
4. 启动该用户的 shell。

```mermaid
sequenceDiagram
    participant Login as login
    participant Shadow as /etc/shadow
    participant Kernel as Kernel
    participant Shell as User Shell
    Login->>Shadow: 读取密码哈希
    Login->>Login: 校验用户输入
    Login->>Kernel: setuid(target)
    Kernel-->>Shell: 以目标 UID 启动
```

![用户数据库保存身份与登录配置，密码哈希在现代系统中移至 shadow 文件](images/shot_00_32_50.png)

### 2.5 `passwd` 悖论与多种 UID

*(参考时间: 35:30)*

普通用户明明不能修改 `/etc/passwd`，为什么可以运行 `passwd` 修改自己的密码？

原因在 setuid：

```bash
ls -l /bin/passwd
```

可以看到：

```text
-rwsr-xr-x root root /bin/passwd
```

owner 执行位的 `x` 变成 `s`，表示程序运行时使用文件 owner 的 uid，而不是调用者 uid：

```text
程序固定，但 euid 会随父进程或 setuid 位变化
```

```mermaid
flowchart LR
    USER["普通用户执行 passwd"] --> SETUID["setuid bit<br/>owner = root"]
    SETUID --> EUID["进程 euid = 0"]
    EUID --> FILE["允许修改 shadow"]
    FILE --> EXIT["程序退出，权限消失"]
```

![setuid 程序在执行期间临时获得文件所有者的权限](images/shot_00_38_20.png)

真实 UNIX 中并不只有一个 uid：

- Real UID：真实调用者身份；
- Effective UID：访问控制实际使用的身份；
- Saved UID：允许程序恢复权限；
- Filesystem UID：Linux 历史上用于独立控制文件访问。

复杂性来自“程序需要临时提权，但提权后又必须能安全恢复”的需求。系统越大，这种兼容性补丁越多。

```mermaid
flowchart TD
    REAL["Real UID"] --> PROCESS["进程身份"]
    EFFECTIVE["Effective UID"] --> ACCESS["实际访问控制"]
    SAVED["Saved UID"] --> RESTORE["权限恢复"]
    FSUID["Filesystem UID"] --> FS["文件系统访问"]
    PROCESS --> SETUID["setuid / seteuid"]
    SETUID --> EFFECTIVE
    SETUID --> SAVED
```

![UID 系统为兼容提权和恢复权限扩展出多个身份字段](images/shot_00_40_20.png)

### 2.6 从 ACL 到可编程访问控制

*(参考时间: 41:00)*

传统 mode 只能表达 owner、group、other 三类。更细粒度的方案包括：

#### POSIX ACL

以文件和用户为单位设置权限，底层通常保存在扩展属性中。

```bash
getfacl file
setfacl -m u:alice:r file
```

#### AppArmor / SELinux

不是只按用户身份判断，而是限制某个程序可以访问的对象集合。例如让 Nginx 只能看到自己的几个目录，即使它被攻破，也看不到 `/etc/passwd`。

#### Capabilities

把 root 的巨大权限拆成行为类别，例如网络原始套接字、挂载文件系统、修改时间等。

```bash
capsh --drop=cap_net_raw -- -c 'ping 127.0.0.1'
```

#### seccomp 与 LSM BPF

在进程或内核安全钩子上运行一段受限制的程序，对每一次系统调用或访问返回 allow/deny。

```mermaid
flowchart TD
    SYSCALL["系统调用"] --> HOOK["LSM Hook"]
    HOOK --> BPF["BPF 检查程序"]
    BPF --> ALLOW["返回允许"]
    BPF --> DENY["返回拒绝"]
    ALLOW --> OBJECT["执行对象访问"]
    DENY --> ERROR["返回权限错误"]
```

![ACL、程序标签、Capabilities 与 BPF 都在从不同维度切片访问控制矩阵](images/shot_00_43_40.png)

---

## 3. 软件系统安全

### 3.1 程序有大量无人理解的路径

*(参考时间: 48:30)*

访问控制只能判断“主体有没有权限访问对象”。即使每一次访问都合法，程序仍然可能被恶意输入引导到异常状态。

原因包括：

- 程序路径复杂，开发者无法穷举；
- 用户行为无法完全预期；
- 恶意用户可以有目的地探索边界条件；
- 一个看似合法的输入可能触发内存破坏、整数溢出或算法退化。

例如无符号整数减法到 0 后继续减一，可能变成极大值，导致“余额无穷大”之类的业务漏洞。

### 3.2 Fuzz Testing：让机器寻找意外输入

*(参考时间: 49:30)*

Fuzz Testing 自动生成大量随机或变异输入，观察程序是否崩溃、卡死、越权或进入异常状态。

典型工具：

- AFL，基于覆盖率引导的灰盒 fuzz；
- OSS-Fuzz，持续 fuzz 开源项目；
- 针对协议、文件格式、编译器和内核的专用 fuzzer。

OSS-Fuzz 已经发现成千上万个漏洞。LLM 加入后，代码审计和输入生成能力进一步提高，攻击者获得 0-day 的速度也可能提高。

```mermaid
flowchart LR
    SEED["初始输入"] --> MUTATE["变异"]
    MUTATE --> RUN["运行目标程序"]
    RUN --> CRASH{"异常？"}
    CRASH -- "否" --> COVER["收集覆盖率"]
    COVER --> MUTATE
    CRASH -- "是" --> TRIAGE["归类与复现"]
    TRIAGE --> VULN["可能得到可利用漏洞"]
```

![Fuzz Testing 通过自动生成异常输入探索程序路径](images/shot_00_50_20.png)

### 3.3 栈缓冲区溢出

*(参考时间: 51:00)*

课堂用一个 `scanf` 读取 64 字节缓冲区的程序说明问题：

```c
char buffer[64];
scanf("%s", buffer);
```

如果输入长度超过缓冲区，写操作会越过边界。返回地址位于更高地址，可能被覆盖。现代编译器会把这种行为视为 undefined behavior。

```text
高地址
+---------------------------+
| caller stack frame        |
+---------------------------+
| return address            |  <-- 溢出可覆盖
+---------------------------+
| saved frame pointer       |
+---------------------------+
| buffer[63] ... buffer[0]  |
+---------------------------+
低地址
```

![栈帧中缓冲区与返回地址相邻，越界写入可能影响控制流](images/shot_00_52_30.png)

在没有保护机制时，攻击者可能把返回地址改成其他代码地址。现实攻击还依赖：

- 栈是否可执行；
- 地址是否随机化；
- 是否能获得 buffer 地址；
- 是否能构造合法参数；
- 目标程序是否拥有更高权限。

#### 编者说明

本书只描述漏洞原理，不提供可直接使用的攻击载荷或地址构造步骤。生产系统的安全研究应在授权环境中进行。

```mermaid
flowchart TD
    INPUT["恶意超长输入"] --> COPY["越界拷贝"]
    COPY --> RETURN["覆盖返回地址"]
    RETURN --> FLOW["劫持控制流"]
    FLOW --> TARGET["跳转到已有代码或注入代码"]
    TARGET --> IMPACT["权限提升或进程被控制"]
```

![缓冲区溢出可以把数据错误变成控制流劫持](images/shot_00_54_40.png)

### 3.4 防御栈攻击

*(参考时间: 56:20)*

现代系统采用多层防御：

#### NX / W^X

栈页面标记为不可执行。即使攻击者把代码写进栈，CPU 也会拒绝执行。

#### ASLR

随机化栈、堆、共享库和代码的基地址，使攻击者无法依赖固定地址。

#### Stack Protector / Canary

在局部变量和返回地址之间放置随机值。函数返回前检查 canary；如果缓冲区溢出覆盖它，程序立即终止。

```text
+---------------------------+
| return address            |
+---------------------------+
| stack canary              |  <-- 溢出必须覆盖它
+---------------------------+
| local buffer              |
+---------------------------+
```

![Canary 像矿井中的金丝雀，用自身被破坏来提示控制流风险](images/shot_00_59_20.png)

#### Control-Flow Integrity

只允许程序按照编译后确定的合法控制流跳转。Intel CET 中的 `endbr64` 标记间接跳转的合法目标。

```mermaid
flowchart TD
    OVERFLOW["栈溢出"] --> NX{"栈可执行？"}
    NX -- "否" --> ROP["尝试复用已有代码片段"]
    ROP --> CFI{"目标是否合法？"}
    CFI -- "否" --> BLOCK["CET / CFI 阻止"]
    NX -- "是" --> MITIGATE["NX 阻止注入执行"]
    OVERFLOW --> CANARY{"Canary 被改？"}
    CANARY -- "是" --> TERM["函数返回前终止"]
    OVERFLOW --> ASLR["ASLR 隐藏地址"]
```

![NX、ASLR、Canary 和 CFI 从不同阶段阻断控制流劫持](images/shot_01_00_30.png)

### 3.5 合法访问也会泄露信息：Timing Side Channel

*(参考时间: 01:02:00)*

课堂给出一个内核密码检查函数：

```c
int check_password(__user char *given_pass) {
    for (i = 0; i <= strlen(correct_pass); i++) {
        if (correct_pass[i] != given_pass[i]) {
            sleep(3);
            return EACCESS;
        }
    }
    return 0;
}
```

看似加入 `sleep(3)` 能阻止暴力尝试，但比较过程具有数据依赖的时间差。攻击者可以观察哪一位比较导致的执行时间不同，逐位推断密码。

在更精细的案例中，攻击者通过控制用户缓冲区的位置，让待比较字节落在页边界上：

- 猜对时，下一次比较需要读取尚未换入的页面；
- 猜错时，循环提前返回；
- 页错误和缓存状态形成可测量时间差；
- 通过分页或缓存信道逐字节恢复信息。

```mermaid
flowchart LR
    GUESS["猜测密码前缀"] --> COMPARE["内核逐字节比较"]
    COMPARE --> PAGE["跨页访问 / Cache 状态"]
    PAGE --> TIME["执行时间差异"]
    TIME --> LEARN["判断当前字节是否正确"]
    LEARN --> NEXT["继续猜下一位"]
```

![密码比较的数据依赖会被页错误和缓存状态转化为时间侧信道](images/shot_01_04_30.png)

### 3.6 Meltdown 与投机执行泄漏

*(参考时间: 01:06:40)*

CPU 为了提高性能会投机执行分支后面的指令。投机执行不允许改变最终架构状态，却可能改变缓存等微架构状态。

Meltdown 的核心条件是：

- 先执行一个最终非法的内核内存访问；
- CPU 在权限异常真正提交前投机读取数据；
- 后续指令用该数据访问探测数组；
- 非法结果虽然被丢弃，缓存状态却保留；
- 另一线程测量探测数组的访问延迟，恢复被读取的字节。

```mermaid
sequenceDiagram
    participant T1 as 攻击线程
    participant CPU as 投机执行
    participant T2 as 测量线程
    T1->>CPU: 非法读取内核数据
    CPU->>CPU: 投机得到 secret
    CPU->>CPU: 访问 probe_array[secret * page]
    CPU-->>T1: 架构异常，结果回滚
    Note over CPU: Cache 状态未完全回滚
    T2->>CPU: 测量各 probe 地址延迟
    T2-->>T2: 恢复 secret
```

![Meltdown 利用投机执行和缓存侧信道泄露本无权读取的数据](images/shot_01_09_30.png)

内核最初把内核空间映射在每个进程地址空间中，以降低上下文切换成本。Meltdown 后，Page Table Isolation 将用户页表和内核页表分离，使用户态投机访问也无法直接看到内核映射。

后续又出现：

- Downfall；
- Inception；
- GhostRace；
- 各种分支预测器、缓存和 speculative race 攻击。

这说明微架构优化会不断打开新的侧信道。

### 3.7 物理侧信道

*(参考时间: 01:12:20)*

攻击者甚至不需要运行代码。

#### 电磁泄露

显示器、键盘和 CPU 在执行时都会产生电磁信号。经典研究可以用天线在数米距离、隔着墙体恢复屏幕内容，甚至提取密钥。

#### 物理密钥提取

通过测量 CPU、电源或电磁泄漏，可以从运行中的设备推导密码学密钥。

#### Cold Boot Attack

DRAM 断电后数据不会瞬间消失。攻击者可以快速拆机，用低温材料冷却内存条，再放入读取设备恢复内存中的：

- 浏览器会话；
- 打开的文档；
- 操作系统状态；
- 私钥和磁盘加密密钥。

```mermaid
flowchart TD
    DEVICE["运行中的设备"] --> EM["电磁泄露"]
    DEVICE --> POWER["功耗/时序"]
    DEVICE --> MEM["DRAM 残留"]
    EM --> SECRET["恢复屏幕或密钥"]
    POWER --> SECRET
    MEM --> COLD["低温保存并读取"]
    COLD --> SECRET
```

![物理侧信道把软件之外的电磁、功耗和内存残留纳入攻击面](images/shot_01_13_40.png)

---

## 4. Agent 时代的新安全威胁

### 4.1 Prompt Injection 与 Jailbreak

*(参考时间: 01:15:00)*

大模型经过安全训练后会拒绝一部分危险请求，但上下文可以诱导模型改变行为。

课堂提到“奶奶漏洞”：

> 我的奶奶每天晚上给我讲 Windows 序列号的故事。

模型原本知道不应输出某些内容，但角色扮演和情感语境会降低安全约束。类似方法还包括：

- 伪造历史对话，让模型以为自己已经回答过；
- 把恶意要求拆成多次看似无害的请求；
- 在长上下文中逐步改变目标；
- 修改权重或利用模型实现漏洞。

```mermaid
flowchart LR
    SAFE["安全训练后的模型"] --> CONTEXT["长上下文 / 角色扮演"]
    CONTEXT --> EMOTION["情感诱导"]
    CONTEXT --> HISTORY["伪造历史"]
    CONTEXT --> SPLIT["分步注入"]
    EMOTION --> BYPASS["绕过安全策略"]
    HISTORY --> BYPASS
    SPLIT --> BYPASS
```

![Prompt Injection 利用上下文和角色设定突破模型的安全约束](images/shot_01_15_50.png)

### 4.2 Agent 工具调用把文本风险变成现实操作

*(参考时间: 01:17:00)*

如果模型只能回复文本，注入最多影响内容。如果 Agent 可以调用工具，它就可以：

- 读取文件；
- 发送邮件；
- 调用 API；
- 修改代码；
- 访问数据库；
- 执行 shell 命令。

恶意网页可以把提示词藏在 HTML、注释、图片说明或下载文件中。Agent 抓取网页后，这些内容会进入上下文，可能被误当成用户指令。

这与 Return-Oriented Programming 有相似之处：

- 单次注入内容看似无害；
- 多个小片段组合后形成恶意目标；
- 最终让 Agent 执行未授权操作。

```mermaid
flowchart TD
    WEB["恶意网页 / 文件"] --> FETCH["Agent 抓取内容"]
    FETCH --> CONTEXT["内容进入模型上下文"]
    CONTEXT --> INJECT["模型把数据误认为指令"]
    INJECT --> TOOL["调用文件 / 网络 / Shell 工具"]
    TOOL --> EXFIL["泄露数据或修改系统"]
```

![Agent 一旦拥有工具权限，Prompt Injection 就可能转化为真实操作](images/shot_01_17_50.png)

防御的核心是：

- 最小权限；
- 沙箱隔离；
- 工具调用白名单；
- 外部内容与指令严格分离；
- 敏感操作需要再次确认；
- 为每次大模型调用分配最小资源。

但完全锁定权限会降低 Agent 能力。开放所有权限又放大注入风险，这是 Agent 时代必须解决的可用性与安全矛盾。

### 4.3 供应链攻击

*(参考时间: 01:19:20)*

现代软件大量依赖第三方包。攻击者不一定攻击最终应用，只要攻破一个依赖即可覆盖成千上万个下游。

#### NPM 包与安装 Hook

攻击过程可以抽象为：

1. 获得 GitHub 仓库或维护者凭据；
2. 创建一个名字具有迷惑性的恶意包；
3. 等待适当时机，以“添加功能”为理由引入依赖；
4. CI/CD 审核通过后发布新版本；
5. 用户安装时触发 `postinstall` Hook；
6. Hook 扫描环境变量、云配置目录和 API Key；
7. 将凭据发送到外部地址。

```mermaid
sequenceDiagram
    participant Attacker as 攻击者
    participant Repo as GitHub Repo
    participant CI as CI/CD
    participant User as 下游用户
    Attacker->>Repo: 注入依赖
    Repo->>CI: 提交 Pull Request / Release
    CI-->>Repo: 审核并发布
    User->>Repo: 安装新版本
    Repo-->>User: 执行 postinstall hook
    User-->>Attacker: API Key / 云凭据被外传
```

![供应链攻击通过依赖安装 Hook 获取开发者凭据](images/shot_01_20_40.png)

### 4.4 XZ Utils 后门

*(参考时间: 01:22:00)*

比恶意 npm 包更隐蔽的是长期社会工程攻击。

XZ Utils 后门的关键点：

- 攻击者花费两到三年建立贡献者信任；
- 在 `liblzma` 构建系统中注入混淆代码；
- 规避编译检查和 fuzz 流程；
- 通过 systemd 影响 sshd；
- 使用 Ed448 密钥尝试实现远程代码执行。

安全影响最终没有全面扩散，原因之一是一个性能异常引起工程师注意。若没有这个性能 Bug，后门可能长期不被发现。

```mermaid
flowchart TD
    IDENTITY["长期贡献者身份"] --> TRUST["建立维护者信任"]
    TRUST --> BUILD["注入构建系统"]
    BUILD --> OBFUSCATE["混淆与规避检测"]
    OBFUSCATE --> DEPENDENT["影响 systemd / sshd"]
    DEPENDENT --> RCE["远程代码执行能力"]
    RCE --> DISCOVER["性能异常导致被发现"]
```

![XZ Utils 后门展示了长期供应链社会工程攻击的隐蔽性](images/shot_01_23_20.png)

---

## 5. 总结：安全是系统设计的横切目标

*(参考时间: 01:23:50)*

本讲从没有保护的 8086 讲到 Agent 时代的供应链攻击。

```mermaid
flowchart TD
    CIA["CIA 三要素"] --> CONF["Confidentiality"]
    CIA --> INTEG["Integrity"]
    CIA --> AVAIL["Availability"]
    CONF --> ACL["访问控制"]
    INTEG --> ACL
    AVAIL --> RESOURCE["资源控制与公平调度"]
    ACL --> UID["UID / GID / Mode"]
    ACL --> ACL2["ACL / AppArmor / Capabilities"]
    ACL --> BPF["seccomp / LSM BPF"]
    ACL --> MEM["内存保护与控制流完整性"]
    ACL --> SIDE["侧信道防御"]
    SIDE --> PHYSICAL["物理攻击面"]
    ACL --> AGENT["Agent 最小权限"]
    AGENT --> SUPPLY["供应链安全"]
```

核心结论：

- 安全不是单独功能，而是贯穿操作系统、编译器、CPU、库和应用的目标；
- 进程隔离与系统调用为访问控制提供了基础边界；
- 访问控制矩阵需要按身份、对象、程序或行为进行低秩近似；
- 合法访问也可能通过时间、缓存、电磁或物理信道泄露信息；
- 内存安全漏洞需要 NX、ASLR、Canary、CFI 等多层防御；
- LLM 无法靠提示词完全防住注入，工具权限必须由沙箱和访问控制约束；
- 供应链攻击提醒我们，可信软件本身也可能在长期演化中被污染。

安全性越高，能做的事情通常越少；能力越开放，攻击面越大。系统设计者必须根据业务风险，在这两者之间做出明确选择。

---

## 附：官方参考与延伸阅读

- [OSDEV: BIOS 与中断调用](https://wiki.osdev.org/BIOS)
- [南京大学小百合历史资料](https://xiaobao.nju.edu.cn/d4/01/c18184a316417/page.htm)
- [Algorithmic Complexity Attack Advisory](https://ocert.org/advisories/ocert-2011-003.html)
- [CVE-2011-4858: Hash Collision DoS](https://nvd.nist.gov/vuln/detail/CVE-2011-4858)
- [Setuid Demystified](https://www.usenix.org/conference/11th-usenix-security-symposium/setuid-demystified)
- [Linux seccomp](https://man7.org/linux/man-pages/man2/seccomp.2.html)
- [LSM BPF](https://docs.kernel.org/bpf/prog_lsm.html)
- [AFL Fuzzing](https://lcamtuf.coredump.cx/afl/)
- [OSS-Fuzz](https://google.github.io/oss-fuzz/)
- [Smashing The Stack For Fun And Profit](https://inst.eecs.berkeley.edu/~cs161/fa08/papers/stack_smashing.pdf)
- [Downfall](https://downfall.page/)
- [Inception](https://comsec.ethz.ch/wp-content/files/inception_sec23.pdf)
- [GhostRace](https://www.vusec.net/projects/ghostrace/)
- [Physical Key Extraction Attacks on PCs](https://dl.acm.org/doi/10.1145/2851486)
- [Cold Boot Attacks on Encryption Keys](https://www.usenix.org/legacy/event/sec08/tech/full_papers/halderman/halderman.pdf)
- [XZ Utils Backdoor](https://en.wikipedia.org/wiki/XZ_Utils_backdoor)

官方课程资料：

- [课程主页](https://jyywiki.cn/OS/2026/)
- [第 28 讲讲义：计算机系统安全](https://jyywiki.cn/OS/2026/lect28.md)
- [视频：28 - 计算机系统安全](https://www.bilibili.com/video/BV1qkEX6FEb5/)

> **版权与署名**：本讲课程材料由蒋炎岩（jyy）编写。课程讲义与幻灯片采用 [Creative Commons BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) 许可；本电子书保留课程出处、作者署名与许可说明。
