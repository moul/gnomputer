import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";

export function SourceExplorer({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useTrailRecorder({
    uri: `gno://${networkId}/source-file/${packagePath}`,
    label: `${packagePath} (source)`,
  });

  useEffect(() => {
    setSelectedFile(null);
  }, [packagePath]);

  const {
    data: files,
    error: filesError,
    isPending: filesPending,
  } = useQuery({
    queryKey: ["source-files", networkId, packagePath],
    queryFn: async () => {
      const env = await sdk.rpc.queryFile(packagePath, new Date().toISOString());
      return env.data
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    },
  });

  const activeFile = selectedFile ?? files?.[0] ?? null;

  const {
    data: source,
    error: sourceError,
    isPending: sourcePending,
  } = useQuery({
    queryKey: ["source-file", networkId, packagePath, activeFile],
    queryFn: async () => {
      const env = await sdk.rpc.queryFile(`${packagePath}/${activeFile}`, new Date().toISOString());
      return env.data;
    },
    enabled: activeFile !== null,
  });

  const error = filesError ?? sourceError;

  return (
    <section className="panel panel--source" aria-label={`Source for ${packagePath}`}>
      <header className="panel__header">
        <span>Source · {packagePath}</span>
      </header>
      <div className="panel__body">
        {error ? (
          <p className="state-line" role="alert">
            Could not load source: {error.message}
          </p>
        ) : filesPending || !files ? (
          <p className="state-line" aria-busy="true">
            Loading source…
          </p>
        ) : (
          <>
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
              {sourcePending ? (
                <p className="state-line" aria-busy="true">
                  Loading file…
                </p>
              ) : (
                <pre>{source}</pre>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
