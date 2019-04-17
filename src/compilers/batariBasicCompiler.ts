"use strict";
import * as path from 'path';
import * as application from '../application';
import * as filesystem from '../filesystem';
import * as execute from '../execute';
import { CompilerBase } from "./compilerBase";

export class BatariBasicCompiler extends CompilerBase {
    
    constructor() {
        super("batariBasic",
                "batari Basic",
                [".bas",".bb"],
                [".bin"],
                path.join(application.Path,"out","bin","compilers","bb"),
                "Stella");
    }

    protected async ExecuteCompilerAsync(): Promise<boolean> {
        console.log('debugger:BatariBasicCompiler.ExecuteCompilerAsync');

        // Premissions
        await this.RepairFilePermissionsAsync();

        // Compiler options
        let commandName = "2600bas.bat"; 
        if (application.IsLinux || application.IsMacOS) {
            // Linux or MacOS
            commandName = "./2600basic.sh";
        }
        
        // Compiler options
        let command = path.join(this.FolderOrPath, commandName);
        // Args
        let args = [
            `"${this.FileName}"`,
            this.Args
        ];
        // Environment
        let env : { [key: string]: string | null } = {};
        env["PATH"] = this.FolderOrPath;
        if (application.IsLinux || application.IsMacOS) {
            // Additional for Linux or MacOS
            env["PATH"] = ":/bin:/usr/bin:" + env["PATH"];
        }
        env["bB"] = this.FolderOrPath;
    
        // Notify
        // Linux and macOS script has this message already
        if (application.IsWindows) application.CompilerOutputChannel.appendLine(`Starting build of ${this.FileName}...`); 

        // Compile
        this.IsRunning = true;
        let executeResult = await execute.Spawn(command, args, env, this.WorkspaceFolder,
            (stdout: string) => {
                // Prepare
                let result = true;

                // Validate (batari Basic)
                if (stdout.includes("Compilation failed") || stdout.includes("error:")) {
                    // bB messages received (so far):
                    // Compilation failed
                    // error: Origin Reverse-indexed
                    // Fatal assembly error: Source is not resolvable.
                    // error: Unknown Mnemonic 'x'
                    // Unrecoverable error(s) in pass, aborting assembly!
                     
                     // Failed
                    result = false;
                }

                // Result
                application.CompilerOutputChannel.append('' + stdout);
                return result;
            },
            (stderr: string) => {
                // Prepare
                let result = true;

                // Validate
                if (stderr.includes("2600 Basic compilation complete.")) {
                    // Ok - bB throws out standard message here that it shouldn't so we need to verify everything arrr...

                } else if (stderr.includes("User-defined score_graphics.asm found in current directory")) {
                    // Ok - bB throws out standard message here that it shouldn't so we need to verify everything arrr...

                } else if (stderr.includes("Parse error") || stderr.includes("error:")) {
                    // bB messages received (so far):
                    // Parse error
                    // Error: 
                     
                     // Failed
                     result = false;

                } else if (stderr.includes("Cannot open includes.bB for reading")) {
                    // Special - seen this when the source is not processed correctly so we'll advise
                    // obviously doesn't get to the point of copying over this file
                    application.CompilerOutputChannel.appendLine("WARNING: An unknown issue has occurred during compilation that may have affected your build....");

                     // Failed
                     result = false;
                }

                // Result
                application.CompilerOutputChannel.append('' + stderr);
                return result;
            });
        this.IsRunning = false;

        // Validate
        if (!executeResult) return false;

        // Finalise
        let result = await this.VerifyCompiledFileSizeAsync();
        if (result) result = await this.MoveFilesToBinFolderAsync();
        if (result) result = await this.RemoveCompilationFilesAsync();
        
        // Result
        return result;
    }

    // protected LoadConfiguration(): boolean {
    //     console.log('debugger:BatariBasicCompiler.LoadConfiguration');  

    //     // Base
    //     if (!super.LoadConfiguration()) return false;

    //     // Result
    //     return true;
    // }

    protected async RepairFilePermissionsAsync(): Promise<boolean> {
        console.log('debugger:BatariBasicCompiler.RepairFilePermissionsAsync'); 

        // Validate
        if (this.CustomFolderOrPath || application.IsWindows) return true;

        // Prepare
        let architecture = "Linux";
        if (application.IsMacOS) architecture = "Darwin";

        // Process
        let result = await filesystem.ChModAsync(path.join(this.FolderOrPath,'2600basic.sh'));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`2600basic.${architecture}.x86`));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`dasm.${architecture}.x86`));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`bbfilter.${architecture}.x86`));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`optimize.${architecture}.x86`));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`postprocess.${architecture}.x86`));
        if (result) result = await filesystem.ChModAsync(path.join(this.FolderOrPath,`preprocess.${architecture}.x86`));
        return result;
    }

    protected async RemoveCompilationFilesAsync(): Promise<boolean> {
        console.log('debugger:BatariBasicCompiler.RemoveCompilationFilesAsync');

        // Language specific files
        if (this.CleanUpCompilationFiles)  {
            // Notify
            application.Notify(`Cleaning up files generated during compilation...`);

            // Process
            await filesystem.RemoveFileAsync(path.join(this.WorkspaceFolder,`${this.FileName}.asm`));
            await filesystem.RemoveFileAsync(path.join(this.WorkspaceFolder,`bB.asm`));
            await filesystem.RemoveFileAsync(path.join(this.WorkspaceFolder,`includes.bB`));
            await filesystem.RemoveFileAsync(path.join(this.WorkspaceFolder,`2600basic_variable_redefs.h`));
        }

        // Debugger files (from workspace not bin)
        // Note: Remove if option is turned off as they are generated by bB (cannot change I believe)
        if (!this.GenerateDebuggerFiles) {
            await this.RemoveDebuggerFilesAsync(this.WorkspaceFolder);
        }

        // Result
        return true;
    }
}