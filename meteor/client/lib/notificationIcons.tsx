import * as React from 'react'

export function WarningIcon() {
	return (
		<svg width="23" height="21" viewBox="0 0 23 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="warning">
			<path
				d="M1.84062 17.6954L10.5186 1.88269C10.8983 1.19084 11.8922 1.19084 12.2719 1.8827L20.9499 17.6954C21.3156 18.3619 20.8334 19.1765 20.0732 19.1765L2.71729 19.1765C1.95709 19.1765 1.47489 18.3619 1.84062 17.6954Z"
				fill="#FFFF00"
				stroke="black"
				strokeWidth="2"
			/>
		</svg>
	)
}

export function CriticalIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="critical">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12.3936 1.01084C13.1893 1.0039 13.9551 1.3133 14.5225 1.87098L18.0489 5.33627C18.6164 5.89395 18.9391 6.65422 18.946 7.44984L18.9892 12.3936C18.9961 13.1893 18.6867 13.9551 18.129 14.5225L14.6637 18.0489C14.1061 18.6164 13.3458 18.9391 12.5502 18.946L7.60636 18.9892C6.81074 18.9961 6.04495 18.6867 5.47745 18.129L1.95115 14.6637C1.38365 14.1061 1.06093 13.3458 1.05399 12.5502L1.01084 7.60636C1.0039 6.81074 1.3133 6.04495 1.87098 5.47745L5.33627 1.95115C5.89395 1.38365 6.65422 1.06093 7.44984 1.05399L12.3936 1.01084Z"
				fill="#FF0000"
				stroke="white"
				strokeWidth="2"
			/>
			<path d="M13.3151 6.5742L6.73631 13.153" stroke="white" strokeWidth="2" />
			<path d="M13.3784 13.267L6.62182 6.51044" stroke="white" strokeWidth="2" />
		</svg>
	)
}
