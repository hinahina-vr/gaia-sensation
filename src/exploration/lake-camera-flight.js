const clamp = value => Math.max(0,Math.min(1,value));
const smooth = value => { const t=clamp(value);return t*t*(3-2*t); };
const mix = (a,b,t) => a+(b-a)*t;
const zoomBetween = (a,b,t) => Math.exp(mix(Math.log(a),Math.log(b),smooth(t)));

// Only exhibit 74 opts into this flight. Other map cameras keep their
// existing interpolation and duration limits.
export function createLakeCameraFlight(start,target,rect,baseScale) {
  const center = view => ({
    x:180-view.offsetX/(baseScale*view.zoom),
    y:90-view.offsetY/(baseScale*view.zoom),
  });
  const a=center(start),b=center(target);
  const distance=Math.hypot(b.x-a.x,b.y-a.y);
  const available=Math.min(rect.width,rect.height);
  const distant=distance*baseScale*Math.min(start.zoom,target.zoom)>available*.9;
  const overviewZoom=Math.min(start.zoom,target.zoom,Math.max(1,available/(Math.max(.001,distance)*baseScale*1.8)));
  const at = progress => {
    const t=clamp(progress);
    if(t===0)return {...start};
    if(t===1)return {...target};
    let zoom,pan;
    if(distant){
      // Pull back before crossing between lakes. Pan mainly while the wide
      // view is visible, then settle over the destination before approaching.
      zoom=t<.5?zoomBetween(start.zoom,overviewZoom,t/.5):zoomBetween(overviewZoom,target.zoom,(t-.5)/.5);
      pan=smooth((t-.32)/.36);
    }else{
      zoom=zoomBetween(start.zoom,target.zoom,t);
      const zoomingIn=target.zoom>start.zoom*1.05,zoomingOut=start.zoom>target.zoom*1.05;
      pan=zoomingIn?smooth(t/.45):zoomingOut?smooth((t-.55)/.45):smooth(t);
    }
    const x=mix(a.x,b.x,pan),y=mix(a.y,b.y,pan);
    return {zoom,offsetX:(180-x)*baseScale*zoom,offsetY:(90-y)*baseScale*zoom};
  };
  const zoomTravel=distant?Math.max(Math.abs(Math.log(start.zoom/overviewZoom)),Math.abs(Math.log(target.zoom/overviewZoom))):Math.abs(Math.log(target.zoom/start.zoom));
  // Drawer/resize reframing may request a shorter duration while a long
  // flight is still running. Keep a large remaining zoom from becoming abrupt.
  return {at,distant,overviewZoom,durationFactor:distant?1.35:1,minimumDurationMs:zoomTravel*(distant?1000:500)};
}
