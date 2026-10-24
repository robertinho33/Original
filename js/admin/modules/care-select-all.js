export function bindCareSelectAll(form){
 for(const group of form.querySelectorAll('[data-care-group]')){
  const all=group.querySelector('[data-care-all]');
  const choices=[...group.querySelectorAll('input[name="care_'+group.dataset.careGroup+'"]')];
  const sync=()=>{const count=choices.filter(input=>input.checked).length;all.checked=choices.length>0&&count===choices.length;all.indeterminate=count>0&&count<choices.length;};
  all.addEventListener('change',()=>{for(const input of choices)input.checked=all.checked;sync();});
  for(const input of choices)input.addEventListener('change',sync);
  sync();
 }
}
