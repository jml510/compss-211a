// Code drills run in a disposable worker with pandas, never on the interface thread.
// Pyodide 0.27.7 (pandas 2.2.3) matches the course interactives; the drill checks were verified against it.
import {drills,drillSetup,drillSetupVariant,drillChecker,variantCode} from './drills.mjs';
import {drillFiles} from './drill-data.mjs';

const ROOT='/home/you/drills';
const HELPERS=String.raw`
import ast, sys, traceback

def _drill_run_cell(code, namespace):
    try:
        tree = ast.parse(code, "<cell>")
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, "<cell>", "exec"), namespace)
        if last is not None:
            value = eval(compile(last, "<cell>", "eval"), namespace)
            if value is Ellipsis:
                print("(... is a placeholder. Replace it with your code.)")
            elif value is not None:
                print(repr(value))
        return True
    except BaseException:
        et, ev, tb = sys.exc_info()
        frames = [f for f in traceback.extract_tb(tb) if f.filename == "<cell>"]
        if frames:
            print("Traceback (most recent call last):", file=sys.stderr)
            print("".join(traceback.format_list(frames)), end="", file=sys.stderr)
        print("".join(traceback.format_exception_only(et, ev)).replace("[Errno 44]", "[Errno 2]"), end="", file=sys.stderr)
        return False
`;
let runtime,sink=null;

async function python(id){
  if(runtime)return runtime;
  self.postMessage({id,type:'loading'});
  const {loadPyodide}=await import('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs');
  const py=await loadPyodide({stdout:()=>{},stderr:()=>{}});
  await py.loadPackage(['pandas'],{messageCallback:()=>{}});
  py.setStdout({batched:text=>sink?.(text+'\n','out')});
  py.setStderr({batched:text=>sink?.(text+'\n','err')});
  py.FS.mkdirTree(ROOT);
  for(const [name,text] of Object.entries(drillFiles))py.FS.writeFile(ROOT+'/'+name,text);
  py.FS.chdir(ROOT);
  py.runPython(HELPERS);
  py.runPython(drillChecker);
  runtime=py;
  return py;
}

// Run code in a fresh namespace. Output is collected only when `output` is an array.
function run(py,setup,code,output){
  const ns=py.toPy({'__name__':'__main__'});
  const cell=py.globals.get('_drill_run_cell');
  try{
    sink=null;if(setup)cell(setup,ns);
    sink=output?(text,kind)=>{if(output.length<400)output.push({text:text.slice(0,4000),kind});}:null;
    const ok=cell(code,ns);
    return {ns,ok};
  }finally{sink=null;cell.destroy();}
}

function check(py,d,code,output){
  const answer=run(py,drillSetup[d.data],d.solution);
  const student=run(py,drillSetup[d.data],code,output);
  const spec=JSON.stringify(d.check);
  try{
    if(!student.ok)return {passed:false,reason:'error'};
    if(d.check.tests){
      const results=JSON.parse(py.globals.get('_drill_tests')(student.ns,answer.ns,spec));
      if(results.some(r=>!r.ok))return {passed:false,reason:'tests',tests:results};
    }
    const message=py.globals.get('_drill_check')(student.ns,answer.ns,spec);
    if(message)return {passed:false,reason:'mismatch',message};
    const swapped=variantCode(d,code);
    if(swapped.missing)return {passed:false,reason:'changed-line',line:swapped.missing};
    if((d.check.variants||[]).length||drillSetupVariant[d.data]){
      const answer2=run(py,drillSetupVariant[d.data],swapped.answer),student2=run(py,drillSetupVariant[d.data],swapped.student);
      try{
        const message2=student2.ok?py.globals.get('_drill_check')(student2.ns,answer2.ns,spec):'error';
        if(message2)return {passed:false,reason:'hardcoded'};
      }finally{answer2.ns.destroy();student2.ns.destroy();}
    }
    return {passed:true,tests:d.check.tests?d.check.exprs.length:0};
  }finally{answer.ns.destroy();student.ns.destroy();}
}

self.onmessage=async({data})=>{
  const {id,mode,drillId,code}=data;
  try{
    const d=drills.find(d=>d.id===drillId);
    if(!d)throw new Error('This drill no longer exists. Reload the page.');
    const py=await python(id);
    self.postMessage({id,type:'running'});
    const output=[];
    if(mode==='example'){const r=run(py,drillSetup[d.data],d.example,output);r.ns.destroy();self.postMessage({id,type:'result',mode,output});return;}
    if(mode==='run'){const r=run(py,drillSetup[d.data],code,output);r.ns.destroy();self.postMessage({id,type:'result',mode,output,ok:r.ok});return;}
    self.postMessage({id,type:'result',mode,output,verdict:check(py,d,code,output)});
  }catch(e){self.postMessage({id,type:'error',message:String(e.message||e).slice(-3000)});}
};
