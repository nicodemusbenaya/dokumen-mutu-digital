import type {MasterValue} from './MasterManager';

export function masterOptions(values:MasterValue[],type:string,current='',all=false){
 const options=values.filter(v=>v.type===type&&(!all||v.isActive)&&(v.isActive||v.value===current)).map(v=>({value:v.value,label:v.label+(v.isActive?'':' (nonaktif)')}));
 if(current&&!options.some(v=>v.value===current))options.push({value:current,label:current+' (nilai saat ini)'});
 return options;
}
type Props={values:MasterValue[];type:string;name?:string;value?:string;defaultValue?:string;onChange?:(value:string)=>void;emptyLabel:string;all?:boolean;disabled?:boolean;required?:boolean};
export function MasterSelect({values,type,name,value,defaultValue,onChange,emptyLabel,all=false,disabled=false,required=false}:Props){
 const current=value??defaultValue??'';
 return <select name={name} value={value} defaultValue={defaultValue} onChange={onChange?e=>onChange(e.target.value):undefined} disabled={disabled} required={required}><option value="">{emptyLabel}</option>{masterOptions(values,type,current,all).map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select>;
}
