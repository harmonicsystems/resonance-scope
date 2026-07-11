/* Resonance Scope — shared pitch (F0) engine. Plain classic script; no deps, no module, no network.
   McLeod Pitch Method (NSDF): the verified detector, extracted from index.html so the resonance
   instrument and the reading page share one implementation. F0.detect() is a pure function of its
   inputs; voiced/unvoiced hysteresis + smoothing stay in each page (tuned per use case). */
(function(){
  "use strict";
  var F0 = window.F0 = {
    MIN:65, MAX:500,                        // search range: 65 Hz ≈ C2 (low male chest voice) … 500 Hz
    MPM_K:0.9,                              // key-maximum threshold (octave defense)
    CLARITY_ENTER:0.93, CLARITY_STAY:0.80,  // voiced/unvoiced hysteresis (applied by callers)
    RMS_MIN:0.005,                          // silence gate
    _nsdf:null                              // reused scratch buffer (grown on demand)
  };

  // Pure NSDF pitch detector. timeBuf: Float32Array of samples (mutated in place for DC removal).
  // Returns {f0, clarity} (Hz, 0..1) or null when silent / no clear pitch.
  F0.detect = function(timeBuf, sampleRate){
    var N=timeBuf.length, sr=sampleRate, i;
    if(!F0._nsdf || F0._nsdf.length<N) F0._nsdf=new Float32Array(N);
    var nsdf=F0._nsdf;
    var mean=0; for(i=0;i<N;i++) mean+=timeBuf[i]; mean/=N;
    var rms=0; for(i=0;i<N;i++){ var x=timeBuf[i]-mean; timeBuf[i]=x; rms+=x*x; }   // DC removal in place
    rms=Math.sqrt(rms/N);
    if(rms<F0.RMS_MIN) return null;                                                 // silence gate
    var tauMin=Math.floor(sr/F0.MAX), tauMax=Math.min(N-1, Math.ceil(sr/F0.MIN));
    if(tauMax<=tauMin+1) return null;
    for(var tau=tauMin;tau<=tauMax;tau++){
      var r=0,m=0, lim=N-tau;
      for(i=0;i<lim;i++){ var a=timeBuf[i], b=timeBuf[i+tau]; r+=a*b; m+=a*a+b*b; }
      nsdf[tau]= m>0 ? 2*r/m : 0;
    }
    // maximum of each positive NSDF lobe (the τ≈0 lobe is skipped — search starts at tauMin)
    var peaks=[], pos=nsdf[tauMin]>0, curMax=nsdf[tauMin], curTau=tauMin;
    for(var t2=tauMin+1;t2<=tauMax;t2++){
      var cur=nsdf[t2];
      if(!pos){ if(cur>0){ pos=true; curMax=cur; curTau=t2; } }
      else { if(cur>curMax){ curMax=cur; curTau=t2; } if(cur<=0){ peaks.push({tau:curTau,val:curMax}); pos=false; } }
    }
    if(pos) peaks.push({tau:curTau,val:curMax});
    if(!peaks.length) return null;
    var nMax=0,p; for(p=0;p<peaks.length;p++) if(peaks[p].val>nMax) nMax=peaks[p].val;
    if(nMax<=0) return null;
    var thresh=F0.MPM_K*nMax, key=null;
    for(p=0;p<peaks.length;p++){ if(peaks[p].val>=thresh){ key=peaks[p]; break; } }  // smallest lag ≥ threshold
    if(!key) return null;
    var tk=key.tau, delta=0, clarity=key.val;
    if(tk>tauMin && tk<tauMax){                                                     // parabolic interpolation (sub-Hz)
      var y0=nsdf[tk-1], y1=nsdf[tk], y2=nsdf[tk+1], denom=(y0-2*y1+y2);
      if(denom!==0){ delta=0.5*(y0-y2)/denom; if(delta>1)delta=1; else if(delta<-1)delta=-1; }
      clarity=y1-0.25*(y0-y2)*delta;
    }
    var f0=sr/(tk+delta);
    if(!isFinite(f0) || f0<62 || f0>555) return null;                              // range sanity
    return {f0:f0, clarity:clarity};
  };

  // nearest note name, e.g. 218 -> "A3"
  F0.noteName = function(hz){
    if(!(hz>0)) return '';
    var NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var midi=Math.round(69+12*Math.log(hz/440)/Math.log(2));
    return NAMES[((midi%12)+12)%12] + (Math.floor(midi/12)-1);
  };
})();
