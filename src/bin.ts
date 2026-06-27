#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { main } from "./cli/app.js";

const io = {
  stdout: (text: string): void => {
    process.stdout.write(text);
  },
  stderr: (text: string): void => {
    process.stderr.write(text);
  },
};

process.exitCode = main(process.argv.slice(2), io);
