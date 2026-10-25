import {spawn} from 'node:child_process';
import {once} from 'node:events';

// Capture real browser frames at normal speed, without generating an animation.
export async function recordCoralMotion(page,file,durationSeconds=8){
  const executable=process.env.GAIA_FFMPEG;
  if(!executable)throw Error('Set GAIA_FFMPEG to an existing ffmpeg executable');
  const fps=12,frames=Math.round(durationSeconds*fps),encoder=spawn(executable,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let stderr='';encoder.stderr.on('data',data=>{stderr+=data;});
  const completion=once(encoder,'close'),start=performance.now();
  try{
    for(let i=0;i<frames;i++){
      const wait=start+i*1000/fps-performance.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
      const buffer=await page.screenshot({type:'jpeg',quality:85});
      if(!encoder.stdin.write(buffer))await once(encoder.stdin,'drain');
    }
  }finally{encoder.stdin.end();}
  const capturedMs=performance.now()-start,[code]=await completion;if(code!==0)throw Error(stderr||`ffmpeg exited ${code}`);
  if(capturedMs>durationSeconds*1000+1000)throw Error(`Capture could not maintain normal speed: ${capturedMs}ms`);
  return{file,fps,frames,durationSeconds:frames/fps,capturedMs};
}
