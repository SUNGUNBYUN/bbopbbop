const ts=require("typescript");
const cfg=ts.readConfigFile("tsconfig.json",ts.sys.readFile).config;
const parsed=ts.parseJsonConfigFileContent(cfg,ts.sys,".");
const prog=ts.createProgram(parsed.fileNames,parsed.options);
const d=ts.getPreEmitDiagnostics(prog).filter(x=>x.file&&/\/(lib|app|components)\//.test(x.file.fileName));
if(!d.length){console.log("NO TYPE ERRORS");process.exit(0);}
for(const x of d.slice(0,15)){const p=x.file.getLineAndCharacterOfPosition(x.start);console.log(x.file.fileName.split("/mnt/bbopbbop/")[1]+":"+(p.line+1)+"  "+ts.flattenDiagnosticMessageText(x.messageText,"\n"));}
