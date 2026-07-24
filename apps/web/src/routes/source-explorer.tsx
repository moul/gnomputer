import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { ErrorState } from "../shell/error-state";
import { CodeEditor } from "../shell/code-editor-lazy";
import { forkFile } from "../shell/fork-script";

export function SourceExplorer({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const hasPackage = packagePath !== "";

  useTrailRecorder(
    {
      uri: `gno://${networkId}/source-file/${packagePath}`,
      label: `${packagePath} › Source`,
    },
    hasPackage
  );

  useEffect(() => {
    setSelectedFile(null);
  }, [packagePath]);

  const {
    data: files,
    error: filesError,
    isPending: filesPending,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["source-files", networkId, packagePath],
    queryFn: async () => {
      const env = await sdk.rpc.queryFile(packagePath, new Date().toISOString());
      return env.data
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    },
    enabled: hasPackage,
  });

  const activeFile = selectedFile ?? files?.[0] ?? null;

  const {
    data: source,
    error: sourceError,
    isPending: sourcePending,
    refetch: refetchSource,
  } = useQuery({
    queryKey: ["source-file", networkId, packagePath, activeFile],
    queryFn: async () => {
      const env = await sdk.rpc.queryFile(`${packagePath}/${activeFile}`, new Date().toISOString());
      return env.data;
    },
    enabled: activeFile !== null,
  });

  const error = filesError ?? sourceError;

  if (!hasPackage) {
    return <p className="state-line">Open a realm to see its source.</p>;
  }
  if (error) {
    return (
      <ErrorState
        message={`Could not load source: ${error.message}`}
        onRetry={() => {
          void refetchFiles();
          void refetchSource();
        }}
      />
    );
  }
  if (filesPending || !files) {
    return (
      <p className="state-line" aria-busy="true">
        Loading source…
      </p>
    );
  }

  return (
    <div className="source-explorer">
      <nav aria-label="File tree" className="file-tree">
        <ul>
          {files.map((file) => (
            <li key={file}>
              <button
                type="button"
                aria-current={file === activeFile}
                onClick={() => setSelectedFile(file)}
              >
                {file}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="source-viewer">
        <div className="source-viewer__toolbar">
          <span className="source-viewer__filename">{activeFile}</span>
          <button
            type="button"
            disabled={sourcePending || !source || !activeFile}
            onClick={() => void forkFile(sdk, activeFile ?? "Untitled", source ?? "")}
          >
            Fork this file → Editor
          </button>
        </div>
        {sourcePending ? (
          <p className="state-line" aria-busy="true">
            Loading file…
          </p>
        ) : (
          <CodeEditor
            key={activeFile}
            value={source ?? ""}
            readOnly
            language={activeFile?.endsWith(".gno") || activeFile?.endsWith(".go") ? "go" : "text"}
          />
        )}
      </div>
    </div>
  );
}
