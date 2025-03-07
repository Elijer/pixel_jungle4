function getVarName(variable: any) {
  return Object.keys({ variable })[0];
}

const moose = [1, 2, 3]

console.log(getVarName(moose))