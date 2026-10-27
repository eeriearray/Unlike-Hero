(function(root){
  'use strict';
  class KartConnection {
    constructor(onMessage,onClose){this.onMessage=onMessage;this.onClose=onClose;this.ws=null;this.id=null;this.pending=null;this.intentional=false;}
    open(command){
      if(location.protocol==='file:'){this.onMessage({type:'error',message:'Online rooms need the hub server. Run npm start and open this game over HTTP.'});return;}
      this.pending=command;
      this.ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/games/crownfall-kart/ws`);
      this.ws.onmessage=event=>{let data;try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='hello'){this.id=data.id;this.send(this.pending);this.pending=null;}
        else this.onMessage(data);
      };
      this.ws.onclose=()=>{if(!this.intentional)this.onClose('Connection lost. Your kart is now driven by AI. Return to the menu to create or join a new room.');};
      this.ws.onerror=()=>{};
    }
    send(data){if(this.ws?.readyState===1)this.ws.send(JSON.stringify(data));}
    close(){this.intentional=true;this.send({type:'leave'});this.ws?.close();this.ws=null;}
  }
  root.KartConnection=KartConnection;
})(window);
