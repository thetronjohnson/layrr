package proxy

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// InjectScript injects JavaScript and CSS into HTML responses
func InjectScript(resp *http.Response, baseURL string) error {
	// Only inject into HTML responses
	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "text/html") {
		return nil
	}

	// Check if response is compressed
	contentEncoding := resp.Header.Get("Content-Encoding")
	var bodyReader io.Reader = resp.Body

	// Decompress if needed
	if contentEncoding == "gzip" {
		gzipReader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzipReader.Close()
		bodyReader = gzipReader
	}

	// Read the (potentially decompressed) response body
	body, err := io.ReadAll(bodyReader)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}
	resp.Body.Close()

	// Remove Content-Encoding and Transfer-Encoding headers since we're sending uncompressed
	resp.Header.Del("Content-Encoding")
	resp.Header.Del("Transfer-Encoding")

	// Skip injection if body is empty or too small to be valid HTML
	if len(body) < 10 {
		resp.Body = io.NopCloser(bytes.NewReader(body))
		return nil
	}

	// Create injection tag for minimal Layrr (hover + selection only, ~1.36 KB)
	// This minimal bundle only handles element highlighting and selection
	// All UI controls are now in the sidebar
	injection := fmt.Sprintf(`
	<!-- Layrr - Minimal Element Selector -->
	<script defer src="%s/inject-minimal.js"></script>
`, baseURL)

	// Try to inject before </body>, otherwise before </html>, otherwise at the end
	bodyStr := string(body)
	var modified string

	if strings.Contains(bodyStr, "</body>") {
		modified = strings.Replace(bodyStr, "</body>", injection+"</body>", 1)
	} else if strings.Contains(bodyStr, "</html>") {
		modified = strings.Replace(bodyStr, "</html>", injection+"</html>", 1)
	} else {
		modified = bodyStr + injection
	}

	// Update the response body
	modifiedBytes := []byte(modified)
	resp.Body = io.NopCloser(bytes.NewReader(modifiedBytes))
	resp.ContentLength = int64(len(modifiedBytes))
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(modifiedBytes)))

	return nil
}
