'use strict';

const fs = require('fs');
const path = require('path');

const source =
  path.resolve(
    process.cwd(),
    'server',
    'data'
  );

const backupRoot =
  path.resolve(
    process.cwd(),
    'server',
    'backups'
  );

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

const destination =
  path.join(
    backupRoot,
    stamp
  );

fs.mkdirSync(
  destination,
  {
    recursive: true
  }
);

function copyRecursive(
  sourcePath,
  destinationPath
) {
  const stat =
    fs.statSync(sourcePath);

  if (stat.isDirectory()) {

    fs.mkdirSync(
      destinationPath,
      {
        recursive: true
      }
    );

    for (
      const entry
      of fs.readdirSync(sourcePath)
    ) {
      copyRecursive(
        path.join(
          sourcePath,
          entry
        ),
        path.join(
          destinationPath,
          entry
        )
      );
    }

    return;
  }

  fs.copyFileSync(
    sourcePath,
    destinationPath
  );
}

copyRecursive(
  source,
  destination
);

console.log(
  `Backup criado em: ${destination}`
);
