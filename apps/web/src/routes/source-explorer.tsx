import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";

export function SourceExplorer({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const [files, setFiles] = useState<string[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTrailRecorder({
    uri: `gno://${sdk.networks.getActive().id}/source-file/${packagePath}`,
    label: `${packagePath} (source)`,
  });

  useEffect(() => {
    setFiles(null);
    setSelectedFile(null);
    setSource(null);
    setError(null);
    sdk.rpc
      .queryFile(packagePath, new Date().toISOString())
      .then((env) => {
        const names = env.data
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        setFiles(names);
        if (names[0]) setSelectedFile(names[0]);
      })
      .catch((err: Error) => setError(err.message));
  }, [packagePath, sdk]);

  useEffect(() => {
    if (!selectedFile) return;
    setSource(null);
    sdk.rpc
      .queryFile(`${packagePath}/${selectedFile}`, new Date().toISOString())
      .then((env) => setSource(env.data))
      .catch((err: Error) => setError(err.message));
  }, [packagePath, selectedFile, sdk]);

  return (
    <section className="panel panel--source" aria-label={`Source for ${packagePath}`}>
      <header className="panel__header">
        <span>Source · {packagePath}</span>
      </header>
      <div className="panel__body">
        {error ? (
          <p className="state-line" role="alert">
            Could not load source: {error}
          </p>
        ) : !files ? (
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
                      aria-current={file === selectedFile}
                      onClick={() => setSelectedFile(file)}
                    >
                      {file}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="source-viewer">
              {source ? (
                <pre>{source}</pre>
              ) : (
                <p className="state-line" aria-busy="true">
                  Loading file…
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
