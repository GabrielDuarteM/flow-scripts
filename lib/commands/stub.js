const fs = require('fs');
const glob = require('glob');
const path = require('path');
const _ = require('lodash');

const constants = require('../constants');

module.exports = function (args, options) {
  const dir = constants.DEFAULT_FLOW_TYPED_DIR;
  const filename = constants.DEFAULT_PACKAGE_DEP_LIBDEFS_FILENAME;
  if (!fs.existsSync(dir)) {
    console.log(`The directory \`${dir}\` does not exist, creating it...`);
    fs.mkdirSync(dir);
  }

  const libdefDir = path.join(process.cwd(), dir, constants.DEFAULT_FLOW_TYPED_NPM_DIR);
  let packagesWithLibdef = [];
  if (fs.existsSync(libdefDir)) {
    const libdefFiles = fs.readdirSync(libdefDir);
    packagesWithLibdef = libdefFiles.map(file => {
      const [, match] = constants.LIBDEF_REGEX.exec(file) || [];
      return match;
    })
      .filter(Boolean);
  } else {
    console.log('No existing community libdefs found. It is recommended to run ' +
      '`flow-typed install` first to pull in community libdefs.\n');
  }

  const fullPackagePath = path.join(process.cwd(), 'package.json');
  const pkg = require(fullPackagePath);
  const dependencies = Object.keys(pkg.dependencies);
  const packagesWithoutLibdef = _.difference(dependencies, packagesWithLibdef);

  let fileContents = '// This file is autogenerated by flow-scripts.\n\n';
  fileContents += packagesWithoutLibdef.map(dep => {
    let depDeclare = createDepDeclare(dep)

    const fullDepPath = path.join(process.cwd(), 'node_modules', dep);
    const fullDepPackagePath = path.join(fullDepPath, 'package.json');

    if (fs.existsSync(fullDepPackagePath)) {
      const pkgDep = JSON.parse(fs.readFileSync(fullDepPackagePath).toString());

      if (pkgDep.module) {
        const modulesFile = fs.readFileSync(path.join(fullDepPath, pkgDep.module)).toString();

        const exportRegex = /['"]\.(.*?)['"]/g;
        let moduleRegexResult = exportRegex.exec(modulesFile);

        while (moduleRegexResult) {
          if (moduleRegexResult[1]) {
            depDeclare += createDepDeclare(dep + moduleRegexResult[1])
          }
          moduleRegexResult = exportRegex.exec(modulesFile)
        }
      }
    }
    
    return depDeclare;
  }).join("");
  fs.writeFileSync(`${dir}/${filename}`, fileContents.trim() + '\n');
  console.log(`Wrote generated libdef stubs to \`${process.cwd()}/${dir}/${filename}\``);
};

function createDepDeclare(dep) {
  console.log(`  Generating stub libdef for "${dep}".`);  
  const declareModule = '' +
`declare module '${dep}' {
  declare module.exports: any;
}`;
  return declareModule + '\n\n';
}