import React from 'react';
import { createPortal } from 'react-dom';
import logo from '../public/sdui-logo.png';
import { newsDate, newsText, parseNews, readStateValue, safeNumber } from './news-utils.js';

const h = React.createElement;
const defaults = {
  itemsOid:'sdui.0.news.items', unreadOid:'sdui.0.news.unread', markReadOid:'sdui.0.news.markRead',
  dialogWidth:560, dialogHeight:680, dialogTop:50, dialogLeft:50,
  dialogPosition:'center', dialogBg:'#ffffff', dialogColor:'#24272d',
  accent:'#e52a62', overlay:'#000000', overlayOpacity:50,
  borderRadius:16, fontSize:15, iconSize:100, showZero:false, closeOnBackdrop:true,
  countColor:'#ffffff',
  maxItems:50
};

export default class SduiNewsWidget extends window.visRxWidget {
  static getWidgetInfo() {
    return {
      id:'tplSduiNewsPopup',
      visPrev: 'widgets/vis-2-widgets-sdui/sdui-news-preview.png', visSet:'sdui', visSetLabel:'SDUI Widgets',
      visSetColor:'#e52a62', visName:'SDUI Logo mit News-Dialog',
      visAttrs:[
        {name:'Datenpunkte',fields:[
          {name:'itemsOid',label:'News JSON',type:'id',default:defaults.itemsOid},
          {name:'unreadOid',label:'Anzahl neuer News',type:'id',default:defaults.unreadOid},
          {name:'markReadOid',label:'Nachricht als gelesen markieren',type:'id',default:defaults.markReadOid}
        ]},
        {name:'Logo und Zähler',fields:[
          
          
          {name:'countColor',label:'Zählerfarbe',type:'color',default:'#ffffff'},
          {name:'showZero',label:'Null anzeigen',type:'checkbox',default:false},
          {name:'accent',label:'Zählerfarbe',type:'color',default:defaults.accent}
        ]},
        {name:'Dialog',fields:[
          {name:'dialogPosition',label:'Position',type:'select',default:'center',options:[
            {value:'center',label:'Mitte'}, {value:'top',label:'Oben'},
            {value:'bottom',label:'Unten'}, {value:'left',label:'Links'},
            {value:'right',label:'Rechts'}, {value:'free',label:'Frei'}
          ]},
          {name:'dialogWidth',label:'Breite (px)',type:'number',default:560,min:240,max:1600},
          {name:'dialogHeight',label:'Höhe (px)',type:'number',default:680,min:200,max:1600},
          {name:'dialogTop',label:'Freie Position Y (%)',type:'number',default:50,min:0,max:100},
          {name:'dialogLeft',label:'Freie Position X (%)',type:'number',default:50,min:0,max:100},
          {name:'dialogBg',label:'Hintergrund',type:'color',default:defaults.dialogBg},
          {name:'dialogColor',label:'Schriftfarbe',type:'color',default:defaults.dialogColor},
          {name:'borderRadius',label:'Eckenradius (px)',type:'number',default:16,min:0,max:60},
          {name:'fontSize',label:'Schriftgröße (px)',type:'number',default:15,min:10,max:32},
          {name:'overlay',label:'Abdunklungsfarbe',type:'color',default:'#000000'},
          {name:'overlayOpacity',label:'Abdunklung (%)',type:'number',default:50,min:0,max:90},
          {name:'closeOnBackdrop',label:'Klick außerhalb schließt',type:'checkbox',default:true},
          {name:'maxItems',label:'Max. angezeigte Nachrichten',type:'number',default:50,min:1,max:200}
        ]}
      ],
      visDefaultStyle:{width:120,height:120}
    };
  }
  getWidgetInfo() { return SduiNewsWidget.getWidgetInfo(); }
  static getI18nPrefix() { return ''; }
  onRxDataChanged() {}
  onStateUpdated() {}

  constructor(props) { super(props); this.state = {...this.state, newsDialogOpen:false}; }
  toggleDialog(value) { this.setState({newsDialogOpen:value}); }

  async markRead(id, oid) {
    if (id === undefined || id === null) return;
    try {
      const socket = this.props.context?.socket ?? this.props.socket;
      if (typeof socket?.setState !== 'function') {
        throw new Error('Kein Socket zum Schreiben verfügbar');
      }
      await socket.setState(oid, String(id));
      this.setState({newsWriteError:''});
    } catch (err) {
      console.error('SDUI News markRead:', err);
      this.setState({newsWriteError:'Als gelesen markieren fehlgeschlagen'});
    }
  }

  async markAllRead() {
    try {
      const socket = this.props.context?.socket ?? this.props.socket;
      if (typeof socket?.setState !== 'function') {
        throw new Error('Kein Socket zum Schreiben verfügbar');
      }
      await socket.setState('sdui.0.news.markAllRead', true);
      this.setState({newsWriteError:''});
    } catch (err) {
      console.error('SDUI News markAllRead:', err);
      this.setState({newsWriteError:'Alle als gelesen markieren fehlgeschlagen'});
    }
  }

  renderWidgetBody(props) {
    super.renderWidgetBody(props);
    const cfg={...defaults,...this.state.rxData};
    const values=this.state.values||{};
    const count=safeNumber(readStateValue(values,cfg.unreadOid),0,0,9999);
    const items=parseNews(readStateValue(values,cfg.itemsOid)).slice(0,safeNumber(cfg.maxItems,50,1,200));
    // Die Logogröße wird direkt durch den VIS-2-Widgetrahmen bestimmt.
    const dialogWidth=safeNumber(cfg.dialogWidth,560,240,1600);
    const dialogHeight=safeNumber(cfg.dialogHeight,680,200,1600);
    const radius=safeNumber(cfg.borderRadius,16,0,60);
    const fontSize=safeNumber(cfg.fontSize,15,10,32);
    const pos=cfg.dialogPosition||'center';
    const align={center:['center','center'],top:['center','flex-start'],bottom:['center','flex-end'],left:['flex-start','center'],right:['flex-end','center'],free:['flex-start','flex-start']}[pos]||['center','center'];
    const overlayCss={position:'fixed',inset:0,zIndex:2147482000,display:'flex',justifyContent:align[0],alignItems:align[1],padding:16,boxSizing:'border-box',backgroundColor:`rgba(0,0,0,${safeNumber(cfg.overlayOpacity,50,0,90)/100})`};
    const dialogCss={position:pos==='free'?'absolute':'relative',left:pos==='free'?`${safeNumber(cfg.dialogLeft,50,0,100)}%`:undefined,top:pos==='free'?`${safeNumber(cfg.dialogTop,50,0,100)}%`:undefined,transform:pos==='free'?'translate(-50%, -50%)':undefined,width:`min(${dialogWidth}px, calc(100vw - 32px))`,height:`min(${dialogHeight}px, calc(100vh - 32px))`,background:cfg.dialogBg,color:cfg.dialogColor,borderRadius:radius,boxShadow:'0 16px 55px rgba(0,0,0,.25)',overflow:'hidden',display:'flex',flexDirection:'column',fontSize};
    const header=h('div',{style:{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid #ddd'}},
      h('strong',null,`SDUI News${count?' · '+count+' neu':''}`),
      h('div',{style:{display:'flex',alignItems:'center',gap:10}},
        h('button',{
          type:'button',
          onClick:()=>this.markAllRead(),
          style:{
            padding:'7px 10px',
            borderRadius:7,
            border:'1px solid #ddd',
            background:cfg.accent,
            color:'#ffffff',
            cursor:'pointer',
            fontSize:'0.85em'
          }
        },'Alle als gelesen'),
        h('button',{
          type:'button',
          onClick:()=>this.toggleDialog(false),
          style:{
            border:0,
            background:'transparent',
            color:'inherit',
            cursor:'pointer',
            fontSize:26
          },
          'aria-label':'Dialog schließen'
        },'×')
      ));
    const messages=items.length?items.map((item,index)=>h('article',{key:String(item.id??index),style:{padding:14,margin:'10px 14px',border:'1px solid #ddd',borderRadius:10}},
      h('div',{style:{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}},
        h('strong',{style:{fontSize:'1.08em'}},String(item.title||'Nachricht')),
        h('small',null,newsDate(item))),
      h('div',{style:{marginTop:8,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},newsText(item)),
      h('div',{style:{marginTop:10,display:'flex',justifyContent:'flex-end'}},
        h('button',{type:'button',onClick:()=>this.markRead(item.id,cfg.markReadOid),style:{padding:'7px 10px',cursor:'pointer',borderRadius:7,border:'1px solid #ddd',background:cfg.accent,color:'#fff'}},'Als gelesen markieren'))
    )):[h('div',{key:'empty',style:{padding:22}},'Keine Nachrichten geladen.')];
    const popup=this.state.newsDialogOpen && typeof document !== 'undefined' ? createPortal(
      h('div',{style:overlayCss,onMouseDown:e=>{if(e.target===e.currentTarget && cfg.closeOnBackdrop)this.toggleDialog(false);}},
        h('section',{role:'dialog','aria-modal':'true','aria-label':'SDUI News',style:dialogCss},
          header,
          h('div',{style:{overflowY:'auto',flex:1}},
            this.state.newsWriteError?h('div',{style:{padding:12,color:'#bb173a'}},this.state.newsWriteError):null,
            ...messages))),document.body):null;
    return h(React.Fragment,null,
      h('button',{
        type:'button',
        'aria-label':`${count} neue SDUI-News öffnen`,
        onClick:()=>this.toggleDialog(true),
        style:{
          width:'100%',height:'100%',
          padding:0,border:0,background:'transparent',
          cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',
          containerType:'size',
          boxSizing:'border-box'
        }
      },
        h('div',{
          style:{
            position:'relative',
            width:'min(100cqw, 100cqh)',
            aspectRatio:'1 / 1',
            flex:'none',
            containerType:'inline-size'
          }
        },
          h('img',{
            src:logo,alt:'SDUI',
            style:{
              width:'100%',height:'100%',
              objectFit:'contain',display:'block'
            }
          }),
          count>0||cfg.showZero
            ?h('span',{
              style:{
                position:'absolute',
                left:'43%',
                top:'71%',
                transform:'translate(-50%,-50%)',
                fontWeight:800,
                color:cfg.countColor||'#ffffff',
                fontSize:'clamp(9px, 18cqw, 54px)',
                lineHeight:1,
                textShadow:'0 1px 2px rgba(0,0,0,.35)',
                pointerEvents:'none'
              }
            },count>99?'99+':count)
            :null
        )
      ),
      popup);
  }
}
