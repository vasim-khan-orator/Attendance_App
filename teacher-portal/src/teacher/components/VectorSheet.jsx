import React, { useEffect, useMemo, useState } from "react";
import { getBiometricVectors } from "../../api/biometricApi";
import { getApiErrorMessage } from "../../api/errorUtils";

const formatEmbeddingPreview = (embedding) => {
	if (!embedding || embedding.length === 0) {
		return "-";
	}
	const preview = embedding.slice(0, 6).map(value => value.toFixed(2));
	return `[${preview.join(", ")}${embedding.length > 6 ? ", ..." : ""}]`;
};

export default function VectorSheet() {
	const [search, setSearch] = useState("");
	const [hoveredRow, setHoveredRow] = useState(null);
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		const loadVectors = async () => {
			try {
				setLoading(true);
				setError("");
				const data = await getBiometricVectors();
				const mapped = (data || []).map((row) => ({
					rollNumber: row.roll_no,
					name: row.name || "",
					status: row.has_vector ? "Registered" : "Not Registered",
					embedding: row.embedding_preview || [],
					updatedAt: row.updated_at,
				}));
				setRows(mapped);
			} catch (err) {
				console.error("Failed to load vector sheet", err);
				setError(getApiErrorMessage(err, "Failed to load vectors"));
			} finally {
				setLoading(false);
			}
		};

		loadVectors();
		const interval = setInterval(loadVectors, 8000);
		return () => clearInterval(interval);
	}, []);

	const filteredData = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return rows;
		return rows.filter(item =>
			item.rollNumber.toLowerCase().includes(term) ||
			item.name.toLowerCase().includes(term)
		);
	}, [rows, search]);

	return (
		<div style={styles.page}>
			<div style={styles.card}>
				<div style={styles.header}>
					<div>
						<div style={styles.title}>Biometric Vector Sheet</div>
						<div style={styles.subtitle}>Registered face embeddings overview</div>
					</div>
					<div style={styles.searchWrap}>
						<input
							type="text"
							placeholder="Search roll number"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							style={styles.searchInput}
						/>
					</div>
				</div>

				<div style={styles.tableWrapper}>
					{loading && <div style={styles.infoState}>Loading vector sheet...</div>}
					{error && <div style={styles.errorState}>{error}</div>}

					{!loading && !error && (
						<>
					<div style={styles.tableHeader}>
						<div style={styles.colRoll}>Roll Number</div>
						<div style={styles.colStatus}>Status</div>
						<div style={styles.colEmbedding}>Embedding Preview</div>
					</div>

					<div style={styles.tableBody}>
						{filteredData.map((item, index) => {
							const isHovered = hoveredRow === index;
							const isRegistered = item.status === "Registered";
							return (
								<div
									key={item.rollNumber}
									style={{
										...styles.row,
										backgroundColor: isHovered
											? "rgba(148, 163, 184, 0.15)"
											: "transparent",
									}}
									onMouseEnter={() => setHoveredRow(index)}
									onMouseLeave={() => setHoveredRow(null)}
								>
									<div style={styles.colRoll}>{item.rollNumber}</div>
									<div style={styles.colStatus}>
										<span
											style={{
												...styles.statusBadge,
												backgroundColor: isRegistered
													? "rgba(34, 197, 94, 0.2)"
													: "rgba(248, 113, 113, 0.2)",
												color: isRegistered ? "#22c55e" : "#f87171",
											}}
										>
											{isRegistered ? "Face Registered" : "Not Registered"}
										</span>
									</div>
									<div style={styles.colEmbedding}>
										<code style={styles.embeddingText}>
											{formatEmbeddingPreview(item.embedding)}
										</code>
									</div>
								</div>
							);
						})}

						{filteredData.length === 0 && (
							<div style={styles.emptyState}>
								No records found for "{search}".
							</div>
						)}
					</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

const styles = {
	page: {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "16px",
		boxSizing: "border-box",
	},
	card: {
		width: "min(900px, 100%)",
		background: "rgba(15, 23, 42, 0.78)",
		borderRadius: "20px",
		padding: "24px",
		border: "1px solid rgba(148, 163, 184, 0.25)",
		boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
		backdropFilter: "blur(18px)",
		color: "#e2e8f0",
		display: "flex",
		flexDirection: "column",
		gap: "16px",
		boxSizing: "border-box",
	},
	header: {
		display: "flex",
		flexWrap: "wrap",
		gap: "16px",
		alignItems: "center",
		justifyContent: "space-between",
	},
	title: {
		fontSize: "22px",
		fontWeight: 700,
		color: "#f8fafc",
	},
	subtitle: {
		fontSize: "13px",
		color: "rgba(226, 232, 240, 0.7)",
		marginTop: "4px",
	},
	searchWrap: {
		flex: "1 1 220px",
		maxWidth: "320px",
	},
	searchInput: {
		width: "100%",
		padding: "10px 14px",
		borderRadius: "12px",
		border: "1px solid rgba(148, 163, 184, 0.4)",
		background: "rgba(15, 23, 42, 0.7)",
		color: "#f8fafc",
		fontSize: "14px",
		outline: "none",
		boxSizing: "border-box",
	},
	tableWrapper: {
		display: "flex",
		flexDirection: "column",
		borderRadius: "16px",
		overflow: "hidden",
		border: "1px solid rgba(148, 163, 184, 0.2)",
	},
	tableHeader: {
		display: "grid",
		gridTemplateColumns: "140px 180px 1fr",
		gap: "12px",
		padding: "12px 16px",
		background: "rgba(15, 23, 42, 0.9)",
		fontSize: "12px",
		textTransform: "uppercase",
		letterSpacing: "1px",
		color: "rgba(148, 163, 184, 0.9)",
	},
	tableBody: {
		display: "flex",
		flexDirection: "column",
		maxHeight: "360px",
		overflowY: "auto",
	},
	row: {
		display: "grid",
		gridTemplateColumns: "140px 180px 1fr",
		gap: "12px",
		padding: "14px 16px",
		alignItems: "center",
		transition: "background 0.2s ease",
	},
	colRoll: {
		fontWeight: 600,
		color: "#f8fafc",
	},
	colStatus: {
		display: "flex",
		alignItems: "center",
	},
	colEmbedding: {
		display: "flex",
		alignItems: "center",
	},
	statusBadge: {
		display: "inline-flex",
		alignItems: "center",
		padding: "6px 10px",
		borderRadius: "999px",
		fontSize: "12px",
		fontWeight: 600,
	},
	embeddingText: {
		fontFamily: "monospace",
		fontSize: "13px",
		color: "#e2e8f0",
		background: "rgba(15, 23, 42, 0.6)",
		padding: "6px 10px",
		borderRadius: "10px",
	},
	emptyState: {
		padding: "20px",
		textAlign: "center",
		color: "rgba(226, 232, 240, 0.7)",
	},
	infoState: {
		padding: "16px",
		textAlign: "center",
		color: "rgba(226, 232, 240, 0.9)",
	},
	errorState: {
		padding: "16px",
		textAlign: "center",
		color: "#fca5a5",
	},
};
