type Track={id?:string;name:string;artist:string;artists?:string[];album?:string;duration?:number;isrc?:string};
type Converter=(s:string)=>Promise<string>;
type Profile={base:string;credits:{person:string;actor:string}[];roles:string[];version:string;readings:Map<string,string>};
export function prepare(t:Track,mode:string,convert:Converter,override?:{name:string;artist:string}):Promise<Profile>;
export function originalQuery(t:Track):string;
export function rank(t:Track,candidates:Track[],mode:string,p:Profile,convert:Converter):Promise<{candidate?:Track;kind:string;reason:string;ordered:(Track&{matchReason:string})[]}>;

export function matchTrack(t:Track,mode:string,convert:Converter,search:(term:string)=>AsyncIterable<Track[]>,override?:{name:string;artist:string},stopped?:()=>boolean,lookupJapanese?:(ids:string[])=>Promise<Track[]>):Promise<{candidate?:Track;kind:string;risk:string;reason:string;ordered:(Track&{matchReason:string})[]}>;
