import numpy as np, wave, sys
SR=48000; DUR=47.0; N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
rs=np.random.default_rng(3)
def T(n): return np.arange(n)/SR
def add(sig,t0,gain=1.0,pan=0.0):
    i=int(t0*SR); n=min(len(sig),N-i)
    if n<=0 or i<0: return
    l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    L[i:i+n]+=sig[:n]*gain*l*1.414; R[i:i+n]+=sig[:n]*gain*r*1.414
def fftfilt(x,lo=None,hi=None):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); H=np.ones_like(f)
    if hi: H*=1/np.sqrt(1+(f/hi)**4)
    if lo: H*=1/np.sqrt(1+(lo/np.maximum(f,1e-3))**4)
    return np.fft.irfft(X*H,len(x))
def mtof(m): return 440*2**((m-69)/12)
def env(n,a=0.005,d=0.3,s=0.0,rel=None):
    t=T(n); e=np.minimum(1,t/max(a,1e-4))
    return e*(s+(1-s)*np.exp(-np.maximum(0,t-a)/d))
def saw(f,n,h=24,det=0.0):
    t=T(n); y=np.zeros(n)
    for k in range(1,h+1):
        if f*k>16000: break
        y+=np.sin(2*np.pi*f*k*t*(1+det))/k
    return y*0.6
# ---------- instruments ----------
def kick(g=1.0):
    n=int(.45*SR); t=T(n); f=45+80*np.exp(-t/0.035); ph=2*np.pi*np.cumsum(f)/SR
    return (np.sin(ph)*np.exp(-t/0.16)+0.3*rs.standard_normal(n)*np.exp(-t/0.004))*g
def clap():
    n=int(.35*SR); x=rs.standard_normal(n); x=fftfilt(x,900,5000); t=T(n); e=np.zeros(n)
    for o in (0,.011,.022): e+=np.where(t>=o,np.exp(-(t-o)/0.012),0)
    e+=np.where(t>=.03,0.6*np.exp(-(t-.03)/0.09),0); return x*e*0.9
def hat(open_=False):
    n=int((.25 if open_ else .06)*SR); x=fftfilt(rs.standard_normal(n),7000,None)
    return x*np.exp(-T(n)/(0.08 if open_ else 0.015))*0.5
def pluck(m,dur=0.35,bright=1.0):
    n=int(dur*SR); t=T(n); f=mtof(m); y=np.zeros(n)
    for k in range(1,12):
        y+=np.sin(2*np.pi*f*k*t)*np.exp(-t*(6+k*4/bright))/k**1.2
    return y*np.minimum(1,t/0.002)*0.5
def bell(m,dur=2.5):
    n=int(dur*SR); t=T(n); f=mtof(m); y=np.zeros(n)
    for r_,a,d in ((1,1,1.4),(2.0,.5,.9),(2.76,.35,.6),(5.4,.2,.25),(8.93,.08,.12)):
        y+=a*np.sin(2*np.pi*f*r_*t)*np.exp(-t/d)
    return y*np.minimum(1,t/0.003)*0.35
def boom():
    n=int(3*SR); t=T(n); f=30+70*np.exp(-t/0.15); ph=2*np.pi*np.cumsum(f)/SR
    nz=fftfilt(rs.standard_normal(n),None,3000)*np.exp(-t/0.35)*0.5
    return (np.sin(ph)*np.exp(-t/0.9)+nz)*0.9
def riser(dur,f0=200,f1=6000):
    n=int(dur*SR); t=T(n); x=rs.standard_normal(n); y=np.zeros(n); a=0.0
    fc=f0*(f1/f0)**(t/dur); al=1-np.exp(-2*np.pi*fc/SR)
    for i in range(n): a+=al[i]*(x[i]-a); y[i]=a
    tone=np.sin(2*np.pi*np.cumsum(110*2**(2.5*t/dur))/SR)*0.25
    return (y*1.6+tone)*(t/dur)**2.2
def whoosh(dur=0.5,up=True):
    n=int(dur*SR); t=T(n); x=rs.standard_normal(n); y=np.zeros(n); a=0.0
    fc=(400*(12)**(t/dur)) if up else (5000*(1/12)**(t/dur)); al=1-np.exp(-2*np.pi*fc/SR)
    for i in range(n): a+=al[i]*(x[i]-a); y[i]=a
    e=np.sin(np.pi*np.minimum(1,t/dur))**2
    return y*e*1.4
def ring(dur=1.1):
    n=int(dur*SR); t=T(n); trill=(np.sin(2*np.pi*14*t)>0).astype(float)
    trill=np.convolve(trill,np.ones(96)/96,'same')
    y=np.sin(2*np.pi*1318*t)*trill+np.sin(2*np.pi*1046*t)*(1-trill)+0.4*np.sin(2*np.pi*2093*t)*trill
    e=np.minimum(1,t/0.01)*np.minimum(1,(dur-t)/0.08)
    return fftfilt(y*e,None,4000)*0.32
def ping(m=88): return bell(m,0.5)*0.9
def tick():
    n=int(0.02*SR); return fftfilt(rs.standard_normal(n),2500,9000)*np.exp(-T(n)/0.003)*0.35
def buzz(dur=0.35):
    n=int(dur*SR); t=T(n); y=np.sign(np.sin(2*np.pi*150*t))*0.3*(np.sin(2*np.pi*30*t)>-.2)
    return fftfilt(y,None,900)*np.minimum(1,(dur-t)/0.03)
# ---------- harmony ----------
CH={'Dm':[50,53,57,62],'Bb':[46,50,53,58],'F':[45,48,53,57],'C':[48,52,55,60]}
ROOT={'Dm':38,'Bb':34,'F':41,'C':36}
PROG=['Dm','Bb','F','C']
def chord_at(t): return PROG[int((t-13)//2)%4] if t>=13 else 'Dm'
def pad(chord,dur,cut=1800):
    n=int(dur*SR); y=np.zeros(n)
    for m in CH[chord]:
        for d in (-0.004,0.0,0.005): y+=saw(mtof(m+12),n,h=10,det=d)
    y=fftfilt(y,None,cut); t=T(n); e=np.minimum(1,t/0.25)*np.minimum(1,(dur-t)/0.3)
    return y*e*0.05
def bassnote(m,dur):
    n=int(dur*SR); y=saw(mtof(m),n,h=16); y=fftfilt(y,None,500); t=T(n)
    return y*np.minimum(1,t/0.004)*np.exp(-t/0.25)*0.6
# ---------- arrangement ----------
music=np.zeros((2,N)); sc=np.ones(N)  # sidechain env
def addm(sig,t0,g=1.0,pan=0.0):
    global L,R
    sL,sR=L.copy(),R.copy(); L[:]=0;R[:]=0; add(sig,t0,g,pan); music[0]+=L; music[1]+=R; L[:]=sL; R[:]=sR
# S1 tension: drone + ticking + rings
n=int(5.75*SR); t=T(n); dr=(np.sin(2*np.pi*36.7*t)+0.5*np.sin(2*np.pi*73.4*t+np.sin(2*np.pi*.3*t)))*np.minimum(1,t/1.5)*0.22
dr+=fftfilt(rs.standard_normal(n),80,600)*0.05*(t/5.75)
addm(dr,0,1.0)
for rt in (0.5,2.0,3.5,5.0): add(ring(),rt,0.38)
miss=[2.0,2.5,2.9,3.25,3.55,3.8,4.0,4.2,4.35,4.5,4.62,4.74,4.85,4.95,5.05,5.14]
for i,m in enumerate(miss): add(ping(86+(i%3)*2),m,0.35,pan=((i*37)%10-5)/6)
tt=1.0;step=0.5
while tt<5.7:
    add(tick(),tt,0.6); tt+=step; step=max(0.09,step*0.9)
add(riser(1.2,300,5000),4.55,0.16)
# S2 footage 6-10: pulse
for k in range(16):
    tb=6+k*0.25; add(bassnote(26,0.24),tb,0.55)
    if k%2==0: addm(fftfilt(kick(),None,300),tb,0.7)
add(whoosh(0.4),7.8,0.25); 
pp=pad('Dm',4.0,700); addm(pp,6.0,0.8)
# S3 statement 10-13: sparse plucks on words then riser
wT=[10.1,10.3,10.5,10.95,11.15,11.35,11.8,12.0,12.2]; notes=[62,65,69,62,65,70,62,65,74]
for w,m in zip(wT,notes): add(pluck(m+12,0.6,0.6),w,0.22,pan=0.2)
add(riser(2.0,150,9000),11.0,0.22)
# S4 impact 13
add(boom(),13.0,0.9)
add(bell(74,3),13.55,0.4,-.3); add(bell(81,3),13.62,0.3,.3); add(bell(86,3),13.75,0.25,0)
addm(pad('Dm',3.5,2600),13.0,1.2)
add(whoosh(0.7),15.7,0.35)
# groove 16.5 - 39.5
for k in range(int((39.5-16.5)/0.5)):
    tb=16.5+k*0.5
    addm(kick(),tb,1.25)
    i=int(tb*SR); sc[i:i+int(.3*SR)]=np.minimum(sc[i:i+int(.3*SR)],0.35+0.65*(np.arange(min(int(.3*SR),N-i))/(0.3*SR))**0.6)
    if k%2==1 and tb>=18.5: addm(clap(),tb,0.55,0.05)
    addm(hat(),tb+0.25,0.5,0.35)
    if tb>=20.5: addm(hat(),tb+0.125,0.22,-0.35); addm(hat(),tb+0.375,0.22,-0.35)
    if tb>=33 and k%4==3: addm(hat(True),tb+0.25,0.35,0.2)
# bass + pads + arp 15 - 39.5
tb=15.0
while tb<39.5:
    ch=chord_at(tb)
    if tb>=16.5:
        for e in range(4):
            m=ROOT[ch]+(12 if e%2 else 0); addm(bassnote(m,0.24),tb+e*0.125+(0.5*(e//4)),0.75)
    tb+=0.5
for b in range(13,39,2):
    ch=chord_at(b); addm(pad(ch,2.05,1400 if b<29 else 2400),b,1.3)
arp_t=17.0
while arp_t<39.4:
    ch=CH[chord_at(arp_t)]; idx=int(round((arp_t-17)/0.125)); m=ch[[0,2,1,3,2,1,3,2][idx%8]]+24
    addm(pluck(m,0.3,1.4 if arp_t>=29 else 0.8),arp_t,0.11 if arp_t<29 else 0.16,pan=0.4*np.sin(idx*0.7))
    arp_t+=0.125
# UI sfx S5
add(bell(84,0.6),17.5,0.35); add(bell(91,0.8),17.62,0.3)
LINES=[(18.0,19.7),(20.2,22.3),(22.9,23.6),(24.1,26.5),(27.0,27.5)]
for a,b in LINES:
    tt=a
    while tt<b: add(tick(),tt,0.35,pan=0.4); tt+=0.035+rs.random()*0.03
for c in (21.3,25.4,26.6): add(bell(88,0.7),c,0.3,-0.3); add(bell(95,0.6),c+0.06,0.2,-0.3)
add(bell(79,0.8),28.0,0.3); add(bell(74,0.8),28.12,0.3)
add(whoosh(0.55),28.4,0.45)
# S6
add(fftfilt(kick(),None,200),30.45,0.6); add(bell(86,1.2),30.5,0.35); add(bell(93,1.0),30.56,0.25)
add(whoosh(0.4),30.85,0.3); add(bell(83,0.5),31.15,0.35,.4); add(bell(88,0.5),31.28,0.35,.4)
# S7
for c in (32.75,34.25,35.75,37.25): add(whoosh(0.35),c,0.4)
n=int(1.25*SR); t=T(n); add(np.sin(2*np.pi*np.cumsum(300*2**(2*t/1.25))/SR)*np.sin(np.pi*t/1.25)*0.08,33.05,1.0)
add(whoosh(0.35,True),34.85,0.25,-0.5); add(whoosh(0.35,True),35.2,0.25,0.5); add(buzz(),35.55,0.5,0.5)
for c in (36.0,36.5,37.0): add(pluck(86,0.4,2),c,0.3)
add(bell(81,1.0),38.05,0.2)
# S8
add(riser(1.0,300,8000),38.5,0.2); add(boom(),39.5,0.8)
add(bell(74,4),39.95,0.35,-.3); add(bell(78,4),40.0,0.3,.3); add(bell(81,4),40.1,0.3); add(bell(86,4),40.15,0.2)
n=int(7.5*SR); t=T(n); y=np.zeros(n)
for m in [50,57,62,65,69,74]:
    for d in (-0.003,0.003): y+=np.sin(2*np.pi*mtof(m)*(1+d)*t)+0.3*np.sin(2*np.pi*mtof(m)*2*(1+d)*t)
y*=np.minimum(1,t/1.2)*np.minimum(1,(7.5-t)/1.5)*0.03; addm(y,39.5,1.0)
add(pluck(74,1.2,0.6),40.5,0.25); add(pluck(77,1.2,0.6),41.5,0.25); add(bell(86,1.5),43.0,0.2); add(bell(93,1.5),43.15,0.15)
# ---- mix: sidechain + ducking during transcript ----
duck=np.ones(N); tt=T(N)
duck*=np.where((tt>17.7)&(tt<28.2),0.82,1.0)
duck=np.convolve(duck,np.ones(4800)/4800,'same')
music*=sc*duck
mix=np.vstack([L,R])+music
# reverb (stereo, decorrelated)
irn=int(2.2*SR); ti=T(irn)
for ch in (0,1):
    ir=rs.standard_normal(irn)*np.exp(-ti/0.55); ir=fftfilt(ir,200,6000); ir/=np.sqrt((ir**2).sum())
    M=1<<int(np.ceil(np.log2(N+irn)))
    wet=np.fft.irfft(np.fft.rfft(mix[ch],M)*np.fft.rfft(ir,M),M)[:N]
    mix[ch]=mix[ch]+0.22*wet
# hard silence 5.75-6.0 (dramatic cut), fade end
cut=(tt>=5.78)&(tt<6.0); mix[:,cut]*=0.0
fe=np.clip((47-tt)/1.0,0,1); mix*=fe
mix=np.tanh(mix*1.2)/np.tanh(1.2); mix/=np.abs(mix).max()/0.89
out=(mix.T*32767).astype(np.int16)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('ok')
